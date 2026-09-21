import concurrent.futures
import json
import os
import re
import threading
import time
from pathlib import Path
from typing import Any

import fitz
import requests
from dotenv import load_dotenv

load_dotenv()


# ============================================================
# CONFIGURATION
# ============================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

MODEL = os.getenv(
    "GEMINI_TRANSLATION_MODEL",
    "gemini-3.7-flash",
)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/"
    f"v1beta/models/{MODEL}:generateContent"
)

MAX_PAGES_PER_BATCH = int(
    os.getenv(
        "TRANSLATION_MAX_PAGES_PER_BATCH",
        "8",
    )
)

MAX_BLOCKS_PER_BATCH = int(
    os.getenv(
        "TRANSLATION_MAX_BLOCKS_PER_BATCH",
        "50",
    )
)

MAX_CHARACTERS_PER_BATCH = int(
    os.getenv(
        "TRANSLATION_MAX_CHARACTERS_PER_BATCH",
        "24000",
    )
)

TRANSLATION_CONCURRENCY = int(
    os.getenv(
        "TRANSLATION_CONCURRENCY",
        "4",
    )
)

MAX_RETRY_ATTEMPTS = int(
    os.getenv(
        "TRANSLATION_MAX_RETRY_ATTEMPTS",
        "4",
    )
)

BASE_RETRY_DELAY = float(
    os.getenv(
        "TRANSLATION_BASE_RETRY_DELAY",
        "1.5",
    )
)

MAX_RETRY_DELAY = float(
    os.getenv(
        "TRANSLATION_MAX_RETRY_DELAY",
        "20",
    )
)

REQUEST_TIMEOUT = int(
    os.getenv(
        "TRANSLATION_REQUEST_TIMEOUT",
        "180",
    )
)

MIN_FONT_SIZE = float(
    os.getenv(
        "TRANSLATION_MIN_FONT_SIZE",
        "5",
    )
)

MAX_FONT_SIZE = float(
    os.getenv(
        "TRANSLATION_MAX_FONT_SIZE",
        "72",
    )
)


if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not configured."
    )


# ============================================================
# EXCEPTIONS
# ============================================================

class TranslationError(RuntimeError):
    """Base translation error."""


class TranslationQuotaError(TranslationError):
    """Provider quota or rate-limit exhaustion."""


class TranslationResponseError(TranslationError):
    """Provider returned malformed or incomplete output."""


class TranslationProviderError(TranslationError):
    """Provider returned a non-recoverable error."""


# ============================================================
# PROCESS-LOCAL CACHE
# ============================================================

_translation_cache: dict[
    tuple[str, str, str],
    str,
] = {}

_cache_lock = threading.Lock()

MAX_CACHE_ENTRIES = int(
    os.getenv(
        "TRANSLATION_MAX_CACHE_ENTRIES",
        "10000",
    )
)


def _cache_get(
    key: tuple[str, str, str],
) -> str | None:

    with _cache_lock:
        return _translation_cache.get(key)


def _cache_set(
    key: tuple[str, str, str],
    value: str,
) -> None:

    with _cache_lock:

        if (
            len(_translation_cache)
            >= MAX_CACHE_ENTRIES
        ):
            first_key = next(
                iter(_translation_cache)
            )
            _translation_cache.pop(
                first_key,
                None,
            )

        _translation_cache[key] = value


# ============================================================
# GENERAL HELPERS
# ============================================================

def _normalize_language(
    language: str,
) -> str:
    return " ".join(
        language.strip().lower().split()
    )


def _sleep_with_backoff(
    attempt: int,
    retry_after: float | None = None,
) -> None:

    if retry_after is not None:
        delay = min(
            max(float(retry_after), 0.5),
            MAX_RETRY_DELAY,
        )
    else:
        delay = min(
            BASE_RETRY_DELAY
            * (
                2
                ** max(
                    attempt - 1,
                    0,
                )
            ),
            MAX_RETRY_DELAY,
        )

    time.sleep(delay)


def _extract_retry_after(
    response: requests.Response,
) -> float | None:

    value = response.headers.get(
        "Retry-After"
    )

    if not value:
        return None

    try:
        return float(value)
    except (
        TypeError,
        ValueError,
    ):
        return None


def _response_text(
    response: requests.Response,
) -> str:

    try:
        return response.text or ""
    except Exception:
        return ""


def _is_hard_quota_error(
    response: requests.Response,
) -> bool:

    text = _response_text(
        response
    ).lower()

    hard_quota_terms = (
        "quota exceeded",
        "quotaexceeded",
        "resource_exhausted",
        "resource exhausted",
        "free_tier",
        "free tier",
        "generate_content_free_tier_requests",
        "daily limit",
        "daily quota",
        "billing account",
        "billing enabled",
        "limit: 0",
    )

    return any(
        term in text
        for term in hard_quota_terms
    )


def _is_retryable_status(
    status_code: int,
) -> bool:

    return status_code in {
        408,
        429,
        500,
        502,
        503,
        504,
    }


def _clean_json_response(
    text: str,
) -> str:

    cleaned = text.strip()

    if cleaned.startswith("```"):
        cleaned = re.sub(
            r"^```(?:json)?\s*",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )

        cleaned = re.sub(
            r"\s*```$",
            "",
            cleaned,
        )

    return cleaned.strip()


def _extract_candidate_text(
    data: dict[str, Any],
) -> str:

    candidates = (
        data.get("candidates")
        or []
    )

    if not candidates:
        raise TranslationResponseError(
            "Translation provider returned no candidates."
        )

    candidate = (
        candidates[0]
        or {}
    )

    content = (
        candidate.get("content")
        or {}
    )

    parts = (
        content.get("parts")
        or []
    )

    text_parts: list[str] = []

    for part in parts:

        if not isinstance(
            part,
            dict,
        ):
            continue

        value = part.get("text")

        if isinstance(
            value,
            str,
        ):
            text_parts.append(
                value
            )

    result = "".join(
        text_parts
    ).strip()

    if not result:
        raise TranslationResponseError(
            "Translation provider returned an empty response."
        )

    return result


# ============================================================
# GEMINI REQUEST
# ============================================================

def _gemini_request(
    prompt: str,
    max_attempts: int = MAX_RETRY_ATTEMPTS,
) -> str:

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
    }

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": prompt,
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
        },
    }

    last_error: Exception | None = None

    for attempt in range(
        1,
        max_attempts + 1,
    ):

        try:

            response = requests.post(
                GEMINI_URL,
                headers=headers,
                json=payload,
                timeout=REQUEST_TIMEOUT,
            )

        except requests.RequestException as exc:

            last_error = exc

            if attempt >= max_attempts:
                raise TranslationProviderError(
                    "The translation provider could not be reached."
                ) from exc

            _sleep_with_backoff(
                attempt
            )

            continue

        status = response.status_code

        # ====================================================
        # SUCCESS
        # ====================================================

        if status == 200:

            try:
                data = response.json()

            except ValueError as exc:

                raise TranslationResponseError(
                    "Translation provider returned invalid JSON."
                ) from exc

            return _extract_candidate_text(
                data
            )

        # ====================================================
        # HARD QUOTA
        #
        # DO NOT RETRY A HARD QUOTA.
        # ====================================================

        if (
            status == 429
            and _is_hard_quota_error(
                response
            )
        ):

            raise TranslationQuotaError(
                "The translation provider quota is exhausted."
            )

        # ====================================================
        # TEMPORARY RATE LIMIT
        # ====================================================

        if status == 429:

            if attempt >= max_attempts:

                raise TranslationQuotaError(
                    "The translation provider is temporarily rate limited."
                )

            retry_after = (
                _extract_retry_after(
                    response
                )
            )

            _sleep_with_backoff(
                attempt,
                retry_after=retry_after,
            )

            continue

        # ====================================================
        # TEMPORARY SERVER FAILURE
        # ====================================================

        if status in {
            408,
            500,
            502,
            503,
            504,
        }:

            if attempt >= max_attempts:

                raise TranslationProviderError(
                    "The translation provider is temporarily unavailable."
                )

            _sleep_with_backoff(
                attempt
            )

            continue

        # ====================================================
        # AUTH / INVALID REQUEST / OTHER
        # ====================================================

        raise TranslationProviderError(
            f"Translation provider rejected the request "
            f"(HTTP {status})."
        )

    if last_error:

        raise TranslationProviderError(
            "Translation provider request failed."
        ) from last_error

    raise TranslationProviderError(
        "Translation provider request failed."
    )


# ============================================================
# SIMPLE TEXT TRANSLATION
# ============================================================

def translate_text(
    text: str,
    source_language: str,
    target_language: str,
) -> str:

    if not text or not text.strip():
        return ""

    if (
        _normalize_language(
            source_language
        )
        == _normalize_language(
            target_language
        )
    ):
        return text

    cache_key = (
        _normalize_language(
            source_language
        ),
        _normalize_language(
            target_language
        ),
        text,
    )

    cached = _cache_get(
        cache_key
    )

    if cached is not None:
        return cached

    prompt = f"""
You are a professional document translator.

Translate the following text from {source_language} to {target_language}.

Rules:

- Translate all meaning-bearing content.
- Preserve the original meaning exactly.
- Do not summarize.
- Do not add explanations.
- Do not remove information.
- Preserve names, numbers, dates, URLs, email addresses,
  identifiers, formulas, and technical terminology.
- Preserve paragraph boundaries.
- Preserve line breaks where practical.
- Do not add commentary.
- Return ONLY the translated text.

TEXT:

{text}
""".strip()

    translated = _gemini_request(
        prompt
    )

    _cache_set(
        cache_key,
        translated,
    )

    return translated


# ============================================================
# TRANSLATION BATCH CREATION
# ============================================================

def _build_translation_batches(
    blocks: list[dict[str, Any]],
) -> list[list[dict[str, Any]]]:

    batches: list[
        list[dict[str, Any]]
    ] = []

    current_batch: list[
        dict[str, Any]
    ] = []

    current_pages: set[int] = set()
    current_characters = 0

    for block in blocks:

        text = str(
            block.get("text")
            or ""
        )

        if not text.strip():
            continue

        page_number = int(
            block.get(
                "page",
                0,
            )
        )

        text_length = len(
            text
        )

        exceeds_page_limit = (
            len(current_pages)
            >= MAX_PAGES_PER_BATCH
            and page_number
            not in current_pages
        )

        exceeds_block_limit = (
            len(current_batch)
            >= MAX_BLOCKS_PER_BATCH
        )

        exceeds_character_limit = (
            current_characters
            + text_length
            > MAX_CHARACTERS_PER_BATCH
        )

        if current_batch and (
            exceeds_page_limit
            or exceeds_block_limit
            or exceeds_character_limit
        ):

            batches.append(
                current_batch
            )

            current_batch = []
            current_pages = set()
            current_characters = 0

        # ====================================================
        # A SINGLE OVERSIZED BLOCK
        #
        # Never create an impossible empty batch.
        # ====================================================

        if (
            not current_batch
            and text_length
            > MAX_CHARACTERS_PER_BATCH
        ):

            start = 0

            while start < text_length:

                end = min(
                    start
                    + MAX_CHARACTERS_PER_BATCH,
                    text_length,
                )

                fragment = {
                    **block,
                    "text": text[
                        start:end
                    ],
                    "id": (
                        f"{block['id']}"
                        f"_fragment_{start}"
                    ),
                }

                batches.append(
                    [fragment]
                )

                start = end

            continue

        current_batch.append(
            block
        )

        current_pages.add(
            page_number
        )

        current_characters += (
            text_length
        )

    if current_batch:
        batches.append(
            current_batch
        )

    return batches


# ============================================================
# BATCH TRANSLATION
# ============================================================

def _translate_block_batch(
    batch: list[dict[str, Any]],
    source_language: str,
    target_language: str,
) -> list[dict[str, Any]]:

    if not batch:
        return []

    results_by_id: dict[
        str,
        str,
    ] = {}

    uncached_blocks: list[
        dict[str, Any]
    ] = []

    source_key = _normalize_language(
        source_language
    )

    target_key = _normalize_language(
        target_language
    )

    # ========================================================
    # CACHE LOOKUP
    # ========================================================

    for block in batch:

        block_id = str(
            block["id"]
        )

        text = str(
            block.get("text")
            or ""
        )

        cache_key = (
            source_key,
            target_key,
            text,
        )

        cached = _cache_get(
            cache_key
        )

        if cached is not None:

            results_by_id[
                block_id
            ] = cached

        else:

            uncached_blocks.append(
                block
            )

    # ========================================================
    # EVERYTHING WAS CACHED
    # ========================================================

    if not uncached_blocks:

        return [
            {
                **block,
                "translated_text": (
                    results_by_id[
                        str(
                            block["id"]
                        )
                    ]
                ),
            }
            for block in batch
        ]

    payload_blocks = [
        {
            "id": str(
                block["id"]
            ),
            "page": int(
                block.get(
                    "page",
                    0,
                )
            ),
            "text": str(
                block.get(
                    "text",
                    "",
                )
            ),
        }
        for block in uncached_blocks
    ]

    payload_json = json.dumps(
        payload_blocks,
        ensure_ascii=False,
    )

    prompt = f"""
You are a professional document translation engine.

Translate EVERY text block from {source_language} to {target_language}.

The input is a JSON array of independent document text blocks.

STRICT REQUIREMENTS:

- Return ONLY valid JSON.
- Return a JSON array.
- Return exactly one object for every input block.
- Preserve every input "id" exactly.
- Do not create new IDs.
- Do not remove IDs.
- Do not merge blocks.
- Do not split blocks.
- Do not omit blocks.
- Preserve numbers.
- Preserve names.
- Preserve URLs.
- Preserve email addresses.
- Preserve dates.
- Preserve identifiers.
- Preserve technical terminology.
- Preserve the complete meaning.
- Do not summarize.
- Do not explain.
- Do not add commentary.
- Put the translated text in the "translation" field.

Required output:

[
  {{
    "id": "original-id",
    "translation": "translated text"
  }}
]

SOURCE LANGUAGE:

{source_language}

TARGET LANGUAGE:

{target_language}

INPUT:

{payload_json}
""".strip()

    raw_response = _gemini_request(
        prompt
    )

    cleaned = _clean_json_response(
        raw_response
    )

    try:

        parsed = json.loads(
            cleaned
        )

    except json.JSONDecodeError as exc:

        raise TranslationResponseError(
            "Translation provider returned malformed translation JSON."
        ) from exc

    if not isinstance(
        parsed,
        list,
    ):

        raise TranslationResponseError(
            "Translation provider returned an invalid translation structure."
        )

    returned: dict[
        str,
        str,
    ] = {}

    for item in parsed:

        if not isinstance(
            item,
            dict,
        ):

            raise TranslationResponseError(
                "Translation provider returned an invalid block."
            )

        block_id = str(
            item.get(
                "id",
                "",
            )
        )

        if not block_id:

            raise TranslationResponseError(
                "Translation provider returned a block without an ID."
            )

        translation = item.get(
            "translation"
        )

        if not isinstance(
            translation,
            str,
        ):

            raise TranslationResponseError(
                f"Translation missing for block {block_id}."
            )

        returned[
            block_id
        ] = translation

    expected_ids = {
        str(
            block["id"]
        )
        for block in uncached_blocks
    }

    returned_ids = set(
        returned.keys()
    )

    missing_ids = (
        expected_ids
        - returned_ids
    )

    unexpected_ids = (
        returned_ids
        - expected_ids
    )

    # ========================================================
    # NEVER SILENTLY ACCEPT INCOMPLETE OUTPUT
    # ========================================================

    if missing_ids:

        raise TranslationResponseError(
            "Translation provider returned an incomplete batch."
        )

    if unexpected_ids:

        raise TranslationResponseError(
            "Translation provider returned unexpected block IDs."
        )

    # ========================================================
    # CACHE RESULTS
    # ========================================================

    for block in uncached_blocks:

        block_id = str(
            block["id"]
        )

        text = str(
            block.get(
                "text",
                "",
            )
        )

        translated = returned[
            block_id
        ]

        cache_key = (
            source_key,
            target_key,
            text,
        )

        _cache_set(
            cache_key,
            translated,
        )

        results_by_id[
            block_id
        ] = translated

    # ========================================================
    # RECONSTRUCT ORIGINAL ORDER
    # ========================================================

    translated_blocks: list[
        dict[str, Any]
    ] = []

    for block in batch:

        block_id = str(
            block["id"]
        )

        translated_blocks.append(
            {
                **block,
                "translated_text": (
                    results_by_id[
                        block_id
                    ]
                ),
            }
        )

    return translated_blocks


# ============================================================
# PARALLEL DOCUMENT TRANSLATION
# ============================================================

def translate_blocks(
    blocks: list[dict[str, Any]],
    source_language: str,
    target_language: str,
) -> list[dict[str, Any]]:

    if not blocks:
        return []

    if (
        _normalize_language(
            source_language
        )
        == _normalize_language(
            target_language
        )
    ):

        return [
            {
                **block,
                "translated_text": (
                    block.get(
                        "text",
                        "",
                    )
                ),
            }
            for block in blocks
        ]

    batches = _build_translation_batches(
        blocks
    )

    if not batches:
        return []

    translated_by_id: dict[
        str,
        dict[str, Any]
    ] = {}

    worker_count = min(
        max(
            1,
            TRANSLATION_CONCURRENCY,
        ),
        len(batches),
    )

    # ========================================================
    # PARALLEL BATCH TRANSLATION
    # ========================================================

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=worker_count
    ) as executor:

        futures = {
            executor.submit(
                _translate_block_batch,
                batch,
                source_language,
                target_language,
            ): index
            for index, batch
            in enumerate(batches)
        }

        try:

            for future in concurrent.futures.as_completed(
                futures
            ):

                translated_batch = (
                    future.result()
                )

                for block in translated_batch:

                    translated_by_id[
                        str(
                            block["id"]
                        )
                    ] = block

        except Exception:

            for future in futures:
                future.cancel()

            raise

    # ========================================================
    # RECONSTRUCT ORIGINAL DOCUMENT ORDER
    # ========================================================

    result: list[
        dict[str, Any]
    ] = []

    missing_blocks: list[str] = []

    for block in blocks:

        block_id = str(
            block["id"]
        )

        translated_block = (
            translated_by_id.get(
                block_id
            )
        )

        if translated_block is None:

            missing_blocks.append(
                block_id
            )

            continue

        result.append(
            translated_block
        )

    if missing_blocks:

        raise TranslationResponseError(
            "Translation completed incompletely."
        )

    return result


# ============================================================
# PDF EXTRACTION
# ============================================================

def extract_pdf_blocks(
    file_path: str,
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
]:

    document = fitz.open(
        file_path
    )

    all_blocks: list[
        dict[str, Any]
    ] = []

    page_data: list[
        dict[str, Any]
    ] = []

    block_counter = 0

    try:

        for page_number, page in enumerate(
            document
        ):

            page_dict = page.get_text(
                "dict"
            )

            page_width = float(
                page.rect.width
            )

            page_height = float(
                page.rect.height
            )

            page_data.append(
                {
                    "page": page_number,
                    "width": page_width,
                    "height": page_height,
                }
            )

            for raw_block in page_dict.get(
                "blocks",
                [],
            ):

                if raw_block.get(
                    "type"
                ) != 0:
                    continue

                lines = raw_block.get(
                    "lines",
                    [],
                )

                spans: list[
                    dict[str, Any]
                ] = []

                text_parts: list[
                    str
                ] = []

                font_names: list[
                    str
                ] = []

                font_sizes: list[
                    float
                ] = []

                colors: list[
                    int
                ] = []

                flags: list[
                    int
                ] = []

                line_texts: list[
                    str
                ] = []

                for line in lines:

                    line_parts: list[
                        str
                    ] = []

                    for span in line.get(
                        "spans",
                        [],
                    ):

                        span_text = span.get(
                            "text",
                            "",
                        )

                        if not span_text:
                            continue

                        text_parts.append(
                            span_text
                        )

                        line_parts.append(
                            span_text
                        )

                        font_name = span.get(
                            "font",
                            "",
                        )

                        if font_name:
                            font_names.append(
                                font_name
                            )

                        if span.get(
                            "size"
                        ) is not None:

                            font_sizes.append(
                                float(
                                    span[
                                        "size"
                                    ]
                                )
                            )

                        if span.get(
                            "color"
                        ) is not None:

                            colors.append(
                                int(
                                    span[
                                        "color"
                                    ]
                                )
                            )

                        if span.get(
                            "flags"
                        ) is not None:

                            flags.append(
                                int(
                                    span[
                                        "flags"
                                    ]
                                )
                            )

                        spans.append(
                            {
                                "text": span_text,
                                "font": font_name,
                                "size": span.get(
                                    "size"
                                ),
                                "color": span.get(
                                    "color"
                                ),
                                "flags": span.get(
                                    "flags"
                                ),
                                "bbox": span.get(
                                    "bbox"
                                ),
                            }
                        )

                    line_texts.append(
                        "".join(
                            line_parts
                        )
                    )

                text = "".join(
                    text_parts
                ).strip()

                if not text:
                    continue

                bbox = raw_block.get(
                    "bbox"
                )

                if (
                    not bbox
                    or len(bbox) != 4
                ):
                    continue

                average_font_size = (
                    sum(font_sizes)
                    / len(font_sizes)
                    if font_sizes
                    else 10.0
                )

                primary_font = (
                    font_names[0]
                    if font_names
                    else "helv"
                )

                primary_color = (
                    colors[0]
                    if colors
                    else 0
                )

                primary_flags = (
                    flags[0]
                    if flags
                    else 0
                )

                block = {
                    "id": (
                        f"block_{block_counter}"
                    ),
                    "page": page_number,
                    "text": text,
                    "bbox": list(
                        bbox
                    ),
                    "font_size": (
                        average_font_size
                    ),
                    "font_name": (
                        primary_font
                    ),
                    "color": (
                        primary_color
                    ),
                    "flags": (
                        primary_flags
                    ),
                    "spans": spans,
                    "lines": line_texts,
                }

                all_blocks.append(
                    block
                )

                block_counter += 1

    finally:

        document.close()

    return (
        all_blocks,
        page_data,
    )


# ============================================================
# LANGUAGE SUPPORT
# ============================================================

def is_rtl_language(
    language: str,
) -> bool:

    normalized = _normalize_language(
        language
    )

    rtl_languages = {
        "arabic",
        "hebrew",
        "persian",
        "farsi",
        "urdu",
        "pashto",
    }

    return normalized in rtl_languages


# ============================================================
# FONT DISCOVERY
# ============================================================

def _candidate_font_paths() -> list[str]:

    return [

        # Linux - DejaVu
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",

        # Noto Sans
        "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
        "/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",

        # Noto Arabic
        "/usr/share/fonts/opentype/noto/NotoSansArabic-Regular.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansArabic-Bold.ttf",

        # Noto Ethiopic
        "/usr/share/fonts/opentype/noto/NotoSansEthiopic-Regular.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansEthiopic-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansEthiopic-VariableFont_wdth,wght.ttf",

        # CJK
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf",

        # Windows
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\tahoma.ttf",
        r"C:\Windows\Fonts\tahomabd.ttf",
    ]


def find_rtl_font() -> str | None:

    candidates = _candidate_font_paths()

    for path in candidates:

        if Path(path).exists():
            return path

    return None


def find_unicode_font(
    language: str,
) -> str | None:

    normalized = _normalize_language(
        language
    )

    candidates: list[str] = []

    # ========================================================
    # AMHARIC / ETHIOPIC
    # ========================================================

    if normalized in {
        "amharic",
        "ethiopic",
    }:

        candidates.extend(
            [
                "/usr/share/fonts/opentype/noto/NotoSansEthiopic-Regular.ttf",
                "/usr/share/fonts/opentype/noto/NotoSansEthiopic-Bold.ttf",
                "/usr/share/fonts/truetype/noto/NotoSansEthiopic-Regular.ttf",
                "/usr/share/fonts/truetype/noto/NotoSansEthiopic-Bold.ttf",
                "/usr/share/fonts/opentype/noto/NotoSansEthiopic-VariableFont_wdth,wght.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            ]
        )

    # ========================================================
    # ARABIC FAMILY
    # ========================================================

    elif normalized in {
        "arabic",
        "persian",
        "farsi",
        "urdu",
        "pashto",
    }:

        candidates.extend(
            [
                "/usr/share/fonts/opentype/noto/NotoSansArabic-Regular.ttf",
                "/usr/share/fonts/opentype/noto/NotoSansArabic-Bold.ttf",
                "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
                "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf",
            ]
        )

    # ========================================================
    # CJK
    # ========================================================

    elif normalized in {
        "chinese",
        "japanese",
        "korean",
    }:

        candidates.extend(
            [
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf",
            ]
        )

    candidates.extend(
        _candidate_font_paths()
    )

    for path in candidates:

        if Path(path).exists():
            return path

    return None


# ============================================================
# COLOR HELPERS
# ============================================================

def _pdf_color_to_rgb(
    color: int,
) -> tuple[
    float,
    float,
    float,
]:

    red = (
        color >> 16
    ) & 255

    green = (
        color >> 8
    ) & 255

    blue = color & 255

    return (
        red / 255.0,
        green / 255.0,
        blue / 255.0,
    )


# ============================================================
# FONT STYLE HELPERS
# ============================================================

def _is_bold(
    flags: int,
    font_name: str,
) -> bool:

    name = (
        font_name
        or ""
    ).lower()

    return bool(
        flags & 16
    ) or any(
        marker in name
        for marker in (
            "bold",
            "black",
            "heavy",
            "semibold",
        )
    )


def _is_italic(
    flags: int,
    font_name: str,
) -> bool:

    name = (
        font_name
        or ""
    ).lower()

    return bool(
        flags & 2
    ) or any(
        marker in name
        for marker in (
            "italic",
            "oblique",
        )
    )


# ============================================================
# BACKGROUND ESTIMATION
# ============================================================

def _estimate_background_color(
    page: fitz.Page,
    bbox: list[float],
) -> tuple[
    float,
    float,
    float,
]:

    try:

        rect = fitz.Rect(
            bbox
        )

        expanded = fitz.Rect(
            max(
                page.rect.x0,
                rect.x0 - 2,
            ),
            max(
                page.rect.y0,
                rect.y0 - 2,
            ),
            min(
                page.rect.x1,
                rect.x1 + 2,
            ),
            min(
                page.rect.y1,
                rect.y1 + 2,
            ),
        )

        pix = page.get_pixmap(
            matrix=fitz.Matrix(
                0.5,
                0.5,
            ),
            clip=expanded,
            colorspace=fitz.csRGB,
            alpha=False,
        )

        samples = pix.samples

        if not samples:
            return (
                1.0,
                1.0,
                1.0,
            )

        count = (
            len(samples)
            // 3
        )

        if count <= 0:
            return (
                1.0,
                1.0,
                1.0,
            )

        red = 0
        green = 0
        blue = 0

        for index in range(
            0,
            len(samples),
            3,
        ):

            red += samples[index]
            green += samples[index + 1]
            blue += samples[index + 2]

        return (
            red / count / 255.0,
            green / count / 255.0,
            blue / count / 255.0,
        )

    except Exception:

        return (
            1.0,
            1.0,
            1.0,
        )


# ============================================================
# TEXT FITTING
# ============================================================

def _insert_text_fitted(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    font_size: float,
    color: tuple[
        float,
        float,
        float,
    ],
    fontfile: str | None,
    rtl: bool,
    font_flags: int = 0,
    font_name: str = "",
) -> bool:

    if not text:
        return True

    size = max(
        MIN_FONT_SIZE,
        min(
            float(font_size),
            MAX_FONT_SIZE,
        ),
    )

    bold = _is_bold(
        font_flags,
        font_name,
    )

    italic = _is_italic(
        font_flags,
        font_name,
    )

    # ========================================================
    # FONT FALLBACK
    # ========================================================

    selected_font = (
        "translation_font"
        if fontfile
        else "helv"
    )

    # ========================================================
    # FIT LOOP
    # ========================================================

    while size >= MIN_FONT_SIZE:

        try:

            result = page.insert_textbox(
                rect,
                text,
                fontsize=size,
                fontname=selected_font,
                fontfile=fontfile,
                color=color,
                align=2 if rtl else 0,
                lineheight=1.12,
                overlay=True,
            )

            if result >= 0:
                return True

        except Exception:
            pass

        size -= 0.5

    # ========================================================
    # FINAL MINIMUM-SIZE ATTEMPT
    # ========================================================

    try:

        result = page.insert_textbox(
            rect,
            text,
            fontsize=MIN_FONT_SIZE,
            fontname=selected_font,
            fontfile=fontfile,
            color=color,
            align=2 if rtl else 0,
            lineheight=1.05,
            overlay=True,
        )

        return result >= 0

    except Exception:

        return False


# ============================================================
# SPAN-BASED STYLE EXTRACTION
# ============================================================

def _primary_span(
    block: dict[str, Any],
) -> dict[str, Any]:

    spans = block.get(
        "spans"
    )

    if isinstance(
        spans,
        list,
    ) and spans:

        first = spans[0]

        if isinstance(
            first,
            dict,
        ):
            return first

    return {}


# ============================================================
# PDF CREATION
# ============================================================

def create_translated_pdf(
    original_file_path: str,
    translated_blocks: list[
        dict[str, Any]
    ],
    output_file_path: str,
    target_language: str,
) -> str:

    source = fitz.open(
        original_file_path
    )

    try:

        fontfile = find_unicode_font(
            target_language
        )

        rtl = is_rtl_language(
            target_language
        )

        blocks_by_page: dict[
            int,
            list[
                dict[str, Any]
            ],
        ] = {}

        for block in translated_blocks:

            page_number = int(
                block.get(
                    "page",
                    0,
                )
            )

            blocks_by_page.setdefault(
                page_number,
                [],
            ).append(
                block
            )

        # ====================================================
        # RENDER EACH PAGE
        # ====================================================

        for page_number in range(
            len(source)
        ):

            page = source[
                page_number
            ]

            page_blocks = (
                blocks_by_page.get(
                    page_number,
                    [],
                )
            )

            if not page_blocks:
                continue

            # =================================================
            # CREATE REDACTION AREAS
            # =================================================

            redactions: list[
                tuple[
                    fitz.Rect,
                    tuple[
                        float,
                        float,
                        float,
                    ],
                ]
            ] = []

            for block in page_blocks:

                bbox = block.get(
                    "bbox"
                )

                if (
                    not bbox
                    or len(bbox) != 4
                ):
                    continue

                rect = fitz.Rect(
                    bbox
                )

                padded = fitz.Rect(
                    max(
                        page.rect.x0,
                        rect.x0 - 0.5,
                    ),
                    max(
                        page.rect.y0,
                        rect.y0 - 0.5,
                    ),
                    min(
                        page.rect.x1,
                        rect.x1 + 0.5,
                    ),
                    min(
                        page.rect.y1,
                        rect.y1 + 0.5,
                    ),
                )

                background = (
                    _estimate_background_color(
                        page,
                        list(padded),
                    )
                )

                redactions.append(
                    (
                        padded,
                        background,
                    )
                )

            for (
                rect,
                background,
            ) in redactions:

                page.add_redact_annot(
                    rect,
                    fill=background,
                )

            if redactions:

                page.apply_redactions(
                    images=fitz.PDF_REDACT_IMAGE_NONE,
                    graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                    text=fitz.PDF_REDACT_TEXT_REMOVE,
                )

            # =================================================
            # INSERT TRANSLATED TEXT
            # =================================================

            for block in page_blocks:

                translated_text = str(
                    block.get(
                        "translated_text",
                        "",
                    )
                    or ""
                ).strip()

                if not translated_text:
                    continue

                bbox = block.get(
                    "bbox"
                )

                if (
                    not bbox
                    or len(bbox) != 4
                ):
                    continue

                rect = fitz.Rect(
                    bbox
                )

                font_size = float(
                    block.get(
                        "font_size",
                        10,
                    )
                )

                font_name = str(
                    block.get(
                        "font_name",
                        "",
                    )
                )

                font_flags = int(
                    block.get(
                        "flags",
                        0,
                    )
                )

                color_value = int(
                    block.get(
                        "color",
                        0,
                    )
                )

                color = (
                    _pdf_color_to_rgb(
                        color_value
                    )
                )

                # Slight vertical allowance without
                # substantially changing the layout.
                expanded_rect = fitz.Rect(
                    rect.x0,
                    rect.y0,
                    rect.x1,
                    min(
                        page.rect.y1,
                        rect.y1
                        + max(
                            1.0,
                            font_size
                            * 0.2,
                        ),
                    ),
                )

                success = (
                    _insert_text_fitted(
                        page=page,
                        rect=expanded_rect,
                        text=translated_text,
                        font_size=font_size,
                        color=color,
                        fontfile=fontfile,
                        rtl=rtl,
                        font_flags=font_flags,
                        font_name=font_name,
                    )
                )

                if not success:

                    # =================================================
                    # LAST-RESORT SLIGHTLY SMALLER BOX
                    # =================================================

                    fallback_rect = fitz.Rect(
                        max(
                            page.rect.x0,
                            rect.x0,
                        ),
                        max(
                            page.rect.y0,
                            rect.y0,
                        ),
                        min(
                            page.rect.x1,
                            rect.x1 + 2,
                        ),
                        min(
                            page.rect.y1,
                            rect.y1 + 3,
                        ),
                    )

                    success = (
                        _insert_text_fitted(
                            page=page,
                            rect=fallback_rect,
                            text=translated_text,
                            font_size=max(
                                MIN_FONT_SIZE,
                                font_size
                                - 1,
                            ),
                            color=color,
                            fontfile=fontfile,
                            rtl=rtl,
                            font_flags=font_flags,
                            font_name=font_name,
                        )
                    )

                if not success:

                    raise TranslationResponseError(
                        "Translated text could not fit within "
                        "the original document layout."
                    )

        # ====================================================
        # SAVE PDF
        # ====================================================

        output_path = Path(
            output_file_path
        )

        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        source.save(
            str(output_path),
            garbage=4,
            deflate=True,
            clean=True,
        )

    finally:

        source.close()

    if not Path(
        output_file_path
    ).exists():

        raise TranslationError(
            "Translated PDF was not created."
        )

    if Path(
        output_file_path
    ).stat().st_size <= 0:

        raise TranslationError(
            "Translated PDF is empty."
        )

    return output_file_path