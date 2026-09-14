import json
import os
import time
from pathlib import Path
from typing import Any

import fitz
import requests
from dotenv import load_dotenv


load_dotenv()


# =========================================================
# CONFIGURATION
# =========================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

MODEL = os.getenv(
    "GEMINI_TRANSLATION_MODEL",
    "gemini-3.7-flash",
)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/"
    f"v1beta/models/{MODEL}:generateContent"
)

# Document translation controls.
#
# These limits intentionally keep individual Gemini requests
# small enough for large documents.
MAX_PAGES_PER_BATCH = 3
MAX_BLOCKS_PER_BATCH = 20
MAX_CHARACTERS_PER_BATCH = 9000

# Minimum delay between Gemini document requests.
# This helps prevent rapid-fire requests.
DOCUMENT_REQUEST_DELAY = 2.0

# Retry configuration.
MAX_RETRY_ATTEMPTS = 5
BASE_RETRY_DELAY = 2.0
MAX_RETRY_DELAY = 30.0


if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not configured."
    )


# =========================================================
# GEMINI REQUEST
# =========================================================

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
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
        },
    }

    last_error = None

    # These are temporary server-side failures.
    retryable_statuses = {
        500,
        502,
        503,
        504,
    }

    for attempt in range(max_attempts):

        try:
            response = requests.post(
                GEMINI_URL,
                headers=headers,
                json=payload,
                timeout=180,
            )

        except requests.RequestException as error:

            last_error = error

            if attempt < max_attempts - 1:

                wait_seconds = min(
                    BASE_RETRY_DELAY * (2 ** attempt),
                    MAX_RETRY_DELAY,
                )

                print(
                    "[TRANSLATION] "
                    "Gemini connection error. "
                    f"Retrying in {wait_seconds:.1f}s "
                    f"(attempt {attempt + 1}/{max_attempts})..."
                )

                time.sleep(wait_seconds)
                continue

            raise RuntimeError(
                "Gemini translation request "
                f"failed after {max_attempts} attempts: "
                f"{error}"
            )

        # -------------------------------------------------
        # SUCCESS
        # -------------------------------------------------

        if response.status_code == 200:

            try:

                data = response.json()

                candidates = data.get(
                    "candidates",
                    [],
                )

                if not candidates:
                    raise RuntimeError(
                        "Gemini returned no candidates."
                    )

                parts = (
                    candidates[0]
                    .get("content", {})
                    .get("parts", [])
                )

                if not parts:
                    raise RuntimeError(
                        "Gemini returned no text."
                    )

                text = parts[0].get(
                    "text",
                    "",
                )

                if not text:
                    raise RuntimeError(
                        "Gemini returned empty text."
                    )

                return text

            except Exception as error:

                raise RuntimeError(
                    "Gemini returned an invalid "
                    f"translation response: {error}"
                )

        # -------------------------------------------------
        # QUOTA / RATE LIMIT
        # -------------------------------------------------

        if response.status_code == 429:

            response_text = response.text

            # IMPORTANT:
            # A quota exhaustion response should not be
            # hammered with repeated retries.
            if (
                "quota" in response_text.lower()
                or "resource_exhausted" in response_text.lower()
                or "exceeded" in response_text.lower()
            ):
                raise RuntimeError(
                    "Gemini translation quota was exceeded. "
                    "The document was not repeatedly retried. "
                    f"Gemini response: {response_text}"
                )

            last_error = response_text

            if attempt < max_attempts - 1:

                wait_seconds = min(
                    BASE_RETRY_DELAY * (2 ** attempt),
                    MAX_RETRY_DELAY,
                )

                print(
                    "[TRANSLATION] "
                    "Gemini rate limit reached. "
                    f"Waiting {wait_seconds:.1f}s..."
                )

                time.sleep(wait_seconds)
                continue

            raise RuntimeError(
                "Gemini translation request failed "
                f"after {max_attempts} attempts: "
                f"429 {response_text}"
            )

        # -------------------------------------------------
        # TEMPORARY SERVER FAILURE
        # -------------------------------------------------

        if response.status_code in retryable_statuses:

            last_error = response.text

            if attempt < max_attempts - 1:

                wait_seconds = min(
                    BASE_RETRY_DELAY * (2 ** attempt),
                    MAX_RETRY_DELAY,
                )

                print(
                    "[TRANSLATION] "
                    f"Gemini returned {response.status_code}. "
                    f"Retrying in {wait_seconds:.1f}s "
                    f"(attempt {attempt + 1}/{max_attempts})..."
                )

                time.sleep(wait_seconds)
                continue

            raise RuntimeError(
                "Gemini translation request "
                f"failed after {max_attempts} attempts: "
                f"{response.status_code} "
                f"{response.text}"
            )

        # -------------------------------------------------
        # OTHER FAILURE
        # -------------------------------------------------

        raise RuntimeError(
            "Gemini translation request failed: "
            f"{response.status_code} "
            f"{response.text}"
        )

    raise RuntimeError(
        "Gemini translation request failed: "
        f"{last_error}"
    )


# =========================================================
# BASIC TEXT TRANSLATION
# =========================================================

def translate_text(
    text: str,
    source_language: str,
    target_language: str,
) -> str:

    if not text.strip():
        return ""

    prompt = f"""
You are a professional document translator.

Translate the following text from:

{source_language}

to:

{target_language}

Rules:

1. Preserve the original meaning exactly.
2. Do not summarize.
3. Do not add information.
4. Do not remove information.
5. Preserve names, numbers, dates, URLs, email addresses,
   technical terms, certifications, company names, and
   proper nouns where appropriate.
6. Preserve paragraph structure.
7. Return only the translated text.
8. Do not provide explanations.

TEXT:

{text}
"""

    return _gemini_request(prompt).strip()


# =========================================================
# BUILD SMALL PDF TRANSLATION BATCHES
# =========================================================

def _build_translation_batches(
    blocks: list[dict[str, Any]],
) -> list[list[dict[str, Any]]]:

    if not blocks:
        return []

    batches = []

    current_batch = []
    current_pages = set()
    current_characters = 0

    for block in blocks:

        block_page = int(
            block.get("page", 0)
        )

        block_text = str(
            block.get("text", "")
        )

        block_characters = len(
            block_text
        )

        if not block_text.strip():
            continue

        proposed_pages = (
            current_pages | {block_page}
        )

        would_exceed_pages = (
            len(proposed_pages)
            > MAX_PAGES_PER_BATCH
        )

        would_exceed_blocks = (
            len(current_batch)
            >= MAX_BLOCKS_PER_BATCH
        )

        would_exceed_characters = (
            current_characters
            + block_characters
            > MAX_CHARACTERS_PER_BATCH
        )

        # If the current batch already contains
        # content, close it before adding this block.
        if current_batch and (
            would_exceed_pages
            or would_exceed_blocks
            or would_exceed_characters
        ):

            batches.append(
                current_batch
            )

            current_batch = []
            current_pages = set()
            current_characters = 0

        current_batch.append(block)

        current_pages.add(
            block_page
        )

        current_characters += (
            block_characters
        )

    if current_batch:
        batches.append(
            current_batch
        )

    return batches


# =========================================================
# CLEAN GEMINI JSON RESPONSE
# =========================================================

def _clean_json_response(
    response: str,
) -> str:

    cleaned = response.strip()

    if cleaned.startswith("```"):

        if cleaned.startswith(
            "```json"
        ):
            cleaned = cleaned[
                len("```json"):
            ]

        elif cleaned.startswith(
            "```JSON"
        ):
            cleaned = cleaned[
                len("```JSON"):
            ]

        else:
            cleaned = cleaned[
                len("```"):
            ]

        if cleaned.endswith("```"):
            cleaned = cleaned[
                :-len("```")
            ]

    return cleaned.strip()


# =========================================================
# TRANSLATE ONE BLOCK BATCH
# =========================================================

def _translate_block_batch(
    batch: list[dict[str, Any]],
    source_language: str,
    target_language: str,
) -> list[dict[str, Any]]:

    payload = []

    for block in batch:

        payload.append(
            {
                "id": block["id"],
                "page": block["page"],
                "text": block["text"],
            }
        )

    prompt = f"""
You are a professional document translator.

Translate EVERY text block below from:

{source_language}

to:

{target_language}

The blocks belong to a real document. Preserve the
meaning and structure of the original document.

Return ONLY a valid JSON array.

Every returned item MUST contain:

{{
    "id": "original id",
    "translation": "translated text"
}}

Rules:

1. Keep every ID exactly unchanged.
2. Do not add IDs.
3. Do not remove IDs.
4. Return exactly one translation for every input block.
5. Preserve meaning exactly.
6. Do not summarize.
7. Do not add explanations.
8. Preserve numbers.
9. Preserve dates.
10. Preserve URLs.
11. Preserve email addresses.
12. Preserve names and proper nouns where appropriate.
13. Preserve technical terminology.
14. Preserve paragraph meaning.
15. Return valid JSON only.
16. Do not wrap the JSON in markdown.
17. Do not combine separate blocks.
18. Do not split a block into multiple items.

TEXT BLOCKS:

{json.dumps(
    payload,
    ensure_ascii=False,
)}
"""

    raw_response = _gemini_request(
        prompt
    )

    cleaned = _clean_json_response(
        raw_response
    )

    try:

        translated = json.loads(
            cleaned
        )

    except json.JSONDecodeError as error:

        raise RuntimeError(
            "Gemini returned invalid JSON "
            "for a document translation batch: "
            f"{error}"
        )

    if not isinstance(
        translated,
        list,
    ):

        raise RuntimeError(
            "Gemini translation response "
            "was not a JSON array."
        )

    translations_by_id = {}

    for item in translated:

        if not isinstance(
            item,
            dict,
        ):
            continue

        block_id = item.get(
            "id"
        )

        translation = item.get(
            "translation",
            "",
        )

        if block_id is not None:

            translations_by_id[
                str(block_id)
            ] = str(
                translation
            )

    translated_blocks = []

    for block in batch:

        block_id = str(
            block["id"]
        )

        translated_text = (
            translations_by_id.get(
                block_id
            )
        )

        # Safety fallback.
        # Never destroy original document
        # content because the model missed one block.
        if translated_text is None:

            translated_text = block[
                "text"
            ]

        translated_block = dict(
            block
        )

        translated_block[
            "translated_text"
        ] = translated_text

        translated_blocks.append(
            translated_block
        )

    return translated_blocks


# =========================================================
# TRANSLATE STRUCTURED PDF BLOCKS
# =========================================================

def translate_blocks(
    blocks: list[dict[str, Any]],
    source_language: str,
    target_language: str,
) -> list[dict[str, Any]]:

    if not blocks:
        return []

    batches = _build_translation_batches(
        blocks
    )

    print(
        "[TRANSLATION] "
        f"Created {len(batches)} "
        "small translation batches."
    )

    translated_blocks = []

    total_batches = len(
        batches
    )

    for batch_index, batch in enumerate(
        batches,
        start=1,
    ):

        pages = sorted(
            {
                int(
                    block.get(
                        "page",
                        0,
                    )
                )
                for block in batch
            }
        )

        first_page = (
            pages[0] + 1
            if pages
            else 0
        )

        last_page = (
            pages[-1] + 1
            if pages
            else 0
        )

        character_count = sum(
            len(
                str(
                    block.get(
                        "text",
                        "",
                    )
                )
            )
            for block in batch
        )

        print(
            "[TRANSLATION] "
            f"Batch {batch_index}/"
            f"{total_batches} | "
            f"Pages {first_page}-{last_page} | "
            f"{len(batch)} blocks | "
            f"{character_count} characters"
        )

        translated_batch = (
            _translate_block_batch(
                batch=batch,
                source_language=source_language,
                target_language=target_language,
            )
        )

        translated_blocks.extend(
            translated_batch
        )

        print(
            "[TRANSLATION] "
            f"Batch {batch_index}/"
            f"{total_batches} completed."
        )

        # Deliberate pause between requests.
        # This prevents rapid-fire Gemini requests.
        if batch_index < total_batches:

            print(
                "[TRANSLATION] "
                f"Waiting {DOCUMENT_REQUEST_DELAY:.1f}s "
                "before next batch..."
            )

            time.sleep(
                DOCUMENT_REQUEST_DELAY
            )

    print(
        "[TRANSLATION] "
        f"Completed translation of "
        f"{len(translated_blocks)} blocks."
    )

    return translated_blocks


# =========================================================
# EXTRACT PDF TEXT BLOCKS
# =========================================================

def extract_pdf_blocks(
    pdf_path: str,
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
]:

    document = fitz.open(
        pdf_path
    )

    all_blocks = []
    page_data = []

    block_counter = 0

    try:

        for page_number in range(
            len(document)
        ):

            page = document[
                page_number
            ]

            page_dict = page.get_text(
                "dict"
            )

            page_blocks = []

            for block in page_dict.get(
                "blocks",
                [],
            ):

                if block.get(
                    "type"
                ) != 0:
                    continue

                lines = block.get(
                    "lines",
                    [],
                )

                text_parts = []

                font_size = 11
                font_name = None
                color = 0
                flags = 0

                for line in lines:

                    for span in line.get(
                        "spans",
                        [],
                    ):

                        text = span.get(
                            "text",
                            "",
                        )

                        if text:
                            text_parts.append(
                                text
                            )

                        font_size = span.get(
                            "size",
                            font_size,
                        )

                        font_name = span.get(
                            "font",
                            font_name,
                        )

                        color = span.get(
                            "color",
                            color,
                        )

                        flags = span.get(
                            "flags",
                            flags,
                        )

                text = "".join(
                    text_parts
                ).strip()

                if not text:
                    continue

                bbox = block.get(
                    "bbox"
                )

                if not bbox:
                    continue

                block_id = str(
                    block_counter
                )

                block_counter += 1

                block_data = {
                    "id": block_id,
                    "page": page_number,
                    "bbox": bbox,
                    "text": text,
                    "font_size": font_size,
                    "font_name": font_name,
                    "color": color,
                    "flags": flags,
                }

                all_blocks.append(
                    block_data
                )

                page_blocks.append(
                    block_data
                )

            page_data.append(
                {
                    "page": page_number,
                    "blocks": page_blocks,
                    "width": page.rect.width,
                    "height": page.rect.height,
                }
            )

    finally:

        document.close()

    return (
        all_blocks,
        page_data,
    )


# =========================================================
# RTL DETECTION
# =========================================================

def is_rtl_language(
    language: str,
) -> bool:

    language_lower = (
        language.lower()
    )

    rtl_languages = [
        "arabic",
        "hebrew",
        "persian",
        "farsi",
        "urdu",
        "pashto",
    ]

    return any(
        language_name
        in language_lower
        for language_name in rtl_languages
    )


# =========================================================
# FIND RTL FONT
# =========================================================

def find_rtl_font() -> str | None:

    possible_fonts = [

        "/usr/share/fonts/truetype/"
        "dejavu/DejaVuSans.ttf",

        "/usr/share/fonts/truetype/"
        "noto/NotoSansArabic-Regular.ttf",

        "C:/Windows/Fonts/arial.ttf",

        "C:/Windows/Fonts/tahoma.ttf",

        "C:/Windows/Fonts/seguiemj.ttf",
    ]

    for font_path in possible_fonts:

        if Path(
            font_path
        ).exists():

            return font_path

    return None


# =========================================================
# CONVERT PDF COLOR
# =========================================================

def _pdf_color_to_rgb(
    color: Any,
) -> tuple[float, float, float]:

    try:

        color_int = int(
            color
        )

        r = (
            (color_int >> 16)
            & 255
        ) / 255

        g = (
            (color_int >> 8)
            & 255
        ) / 255

        b = (
            color_int
            & 255
        ) / 255

        return (
            r,
            g,
            b,
        )

    except Exception:

        return (
            0,
            0,
            0,
        )


# =========================================================
# CREATE TRANSLATED PDF
# =========================================================

def create_translated_pdf(
    input_pdf: str,
    output_pdf: str,
    translated_blocks: list[
        dict[str, Any]
    ],
    target_language: str,
) -> None:

    document = fitz.open(
        input_pdf
    )

    rtl = is_rtl_language(
        target_language
    )

    rtl_font = None

    if rtl:
        rtl_font = find_rtl_font()

    try:

        blocks_by_page = {}

        for block in translated_blocks:

            page_number = block[
                "page"
            ]

            blocks_by_page.setdefault(
                page_number,
                [],
            ).append(
                block
            )

        for page_number, blocks in (
            blocks_by_page.items()
        ):

            page = document[
                page_number
            ]

            # -------------------------------------------------
            # Redact original text
            # -------------------------------------------------

            for block in blocks:

                bbox = block[
                    "bbox"
                ]

                rect = fitz.Rect(
                    bbox
                )

                page.add_redact_annot(
                    rect,
                    fill=(1, 1, 1),
                )

            page.apply_redactions()

            # -------------------------------------------------
            # Insert translated text
            # -------------------------------------------------

            for block in blocks:

                translated_text = (
                    block.get(
                        "translated_text",
                        block["text"],
                    )
                )

                if not translated_text:
                    continue

                rect = fitz.Rect(
                    block["bbox"]
                )

                font_size = float(
                    block.get(
                        "font_size",
                        11,
                    )
                )

                font_size = max(
                    6,
                    min(
                        font_size,
                        40,
                    ),
                )

                text_color = (
                    _pdf_color_to_rgb(
                        block.get(
                            "color",
                            0,
                        )
                    )
                )

                insert_kwargs = {
                    "fontsize": font_size,
                    "color": text_color,
                }

                if rtl:

                    insert_kwargs[
                        "align"
                    ] = 2

                    if rtl_font:

                        insert_kwargs[
                            "fontfile"
                        ] = rtl_font

                else:

                    insert_kwargs[
                        "align"
                    ] = 0

                page.insert_textbox(
                    rect,
                    translated_text,
                    **insert_kwargs,
                )

        document.save(
            output_pdf,
            garbage=4,
            deflate=True,
        )

    finally:

        document.close()