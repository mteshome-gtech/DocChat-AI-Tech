import json
import os
import time
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from supabase import Client, create_client
from google import genai
from google.genai import types

from app.routes.upload import get_authenticated_user


load_dotenv()


router = APIRouter(
    prefix="/compare",
    tags=["Compare"],
)


# ---------------------------------------------------------
# Environment
# ---------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL")

SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)

GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY"
)

GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.7-flash",
)


if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL is not configured."
    )


if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
    )


if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not configured."
    )


supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)


gemini_client = genai.Client(
    api_key=GEMINI_API_KEY
)


# ---------------------------------------------------------
# Request model
# ---------------------------------------------------------

class CompareRequest(BaseModel):
    document_a_id: str = Field(
        min_length=1
    )

    document_b_id: str = Field(
        min_length=1
    )

    compare_type: str = "full"

    depth: str = "standard"


# ---------------------------------------------------------
# Validation
# ---------------------------------------------------------

VALID_COMPARE_TYPES = {
    "full",
    "changes",
    "similarities",
}


VALID_DEPTHS = {
    "quick",
    "standard",
    "deep",
}


# ---------------------------------------------------------
# Comparison instructions
# ---------------------------------------------------------

COMPARE_TYPE_INSTRUCTIONS = {
    "full": """
Perform a complete comparison.

Identify:
- important additions
- important removals
- meaningful modifications
- major similarities

Focus on substantive changes rather than formatting differences.
""",

    "changes": """
Focus primarily on meaningful changes.

Identify:
- important additions
- important removals
- modified information
- changes in meaning, requirements, conclusions,
  numbers, dates, policies, or recommendations.

Ignore insignificant formatting differences.
""",

    "similarities": """
Focus primarily on similarities.

Identify:
- shared concepts
- overlapping claims
- common conclusions
- matching facts
- similar recommendations
- areas where both documents agree.

Also identify important differences when necessary
to correctly understand the similarities.
""",
}


DEPTH_INSTRUCTIONS = {
    "quick": """
Perform a concise comparison.

Focus only on the most important differences
and similarities.
""",

    "standard": """
Perform a balanced comparison with meaningful detail.

Identify the major changes and similarities while
avoiding unnecessary repetition.
""",

    "deep": """
Perform a comprehensive comparison.

Carefully cross-check both documents and identify
subtle but meaningful differences, changes in meaning,
contradictions, and important areas of agreement.
""",
}


# ---------------------------------------------------------
# Load document
# ---------------------------------------------------------

def load_document(
    user_id: str,
    document_id: str,
) -> dict[str, Any]:

    try:
        document_result = (
            supabase
            .table("documents")
            .select(
                "id, name, file_name"
            )
            .eq(
                "id",
                document_id,
            )
            .eq(
                "user_id",
                user_id,
            )
            .single()
            .execute()
        )

    except Exception as error:
        print(
            "Compare document lookup error:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve the selected document."
            ),
        ) from error

    document = document_result.data

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    try:
        chunks_result = (
            supabase
            .table("document_chunks")
            .select(
                "chunk_index, content"
            )
            .eq(
                "document_id",
                document_id,
            )
            .order(
                "chunk_index",
                desc=False,
            )
            .execute()
        )

    except Exception as error:
        print(
            "Compare document chunks error:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve the document content."
            ),
        ) from error

    chunks = chunks_result.data or []

    content_parts: list[str] = []

    for chunk in chunks:
        content = (
            chunk.get("content")
            or ""
        )

        if content.strip():
            content_parts.append(
                content.strip()
            )

    content = "\n\n".join(
        content_parts
    )

    if not content.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "The selected document does not "
                "contain readable text."
            ),
        )

    return {
        "id": str(
            document["id"]
        ),

        "name": (
            document.get("name")
            or document.get("file_name")
            or "Untitled document"
        ),

        "content": content,
    }


# ---------------------------------------------------------
# Prompt
# ---------------------------------------------------------

def build_compare_prompt(
    document_a: dict[str, Any],
    document_b: dict[str, Any],
    compare_type: str,
    depth: str,
) -> str:

    type_instructions = (
        COMPARE_TYPE_INSTRUCTIONS.get(
            compare_type,
            COMPARE_TYPE_INSTRUCTIONS["full"],
        )
    )

    depth_instructions = (
        DEPTH_INSTRUCTIONS.get(
            depth,
            DEPTH_INSTRUCTIONS["standard"],
        )
    )

    return f"""
You are DocChatAI Compare Intelligence.

Your task is to compare two documents and produce
an accurate, evidence-based comparison.

DOCUMENT A

Name:
{document_a["name"]}

Content:
{document_a["content"]}


DOCUMENT B

Name:
{document_b["name"]}

Content:
{document_b["content"]}


COMPARISON TYPE

{compare_type}

{type_instructions}


COMPARISON DEPTH

{depth}

{depth_instructions}


IMPORTANT RULES

1. Compare only information actually present
   in the supplied documents.

2. Do not fabricate information.

3. Do not introduce external facts.

4. Do not assume one document is correct simply
   because it appears newer or more authoritative.

5. Distinguish meaningful content changes from
   formatting or wording changes.

6. If information appears in both documents but
   has materially different meaning, classify it
   as modified.

7. If a substantive point exists only in Document A,
   classify it as removed.

8. If a substantive point exists only in Document B,
   classify it as added.

9. Identify contradictions when applicable.

10. Keep each result concise but informative.

11. The summary should explain the overall relationship
    between the documents.

12. Return ONLY valid JSON.

RETURN EXACTLY THIS STRUCTURE:

{{
  "summary": "A concise overall comparison.",
  "added": [
    "Important content present in Document B but not Document A."
  ],
  "removed": [
    "Important content present in Document A but not Document B."
  ],
  "modified": [
    "Important content that changed between the documents."
  ],
  "similarities": [
    "Important information shared by both documents."
  ]
}}

If a category has no meaningful findings,
return an empty array.

Do not use markdown.
Do not wrap the JSON in code fences.
"""


# ---------------------------------------------------------
# JSON extraction
# ---------------------------------------------------------

def extract_json(
    text: str,
) -> dict[str, Any]:

    cleaned = text.strip()

    if not cleaned:
        raise RuntimeError(
            "Comparison AI returned an empty response."
        )

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()

        if (
            lines
            and lines[0].strip().startswith("```")
        ):
            lines = lines[1:]

        if (
            lines
            and lines[-1].strip() == "```"
        ):
            lines = lines[:-1]

        cleaned = "\n".join(
            lines
        ).strip()

        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        result = json.loads(
            cleaned
        )

    except json.JSONDecodeError as error:
        print(
            "Compare JSON parsing error:",
            repr(error),
        )

        print(
            "Compare raw Gemini response:",
            cleaned[:5000],
        )

        raise RuntimeError(
            "Comparison AI returned invalid JSON."
        ) from error

    if not isinstance(
        result,
        dict,
    ):
        raise RuntimeError(
            "Comparison AI returned an invalid result."
        )

    return result


# ---------------------------------------------------------
# Result cleanup
# ---------------------------------------------------------

def clean_list(
    value: Any,
) -> list[str]:

    if not isinstance(
        value,
        list,
    ):
        return []

    cleaned: list[str] = []

    for item in value:
        if item is None:
            continue

        text = str(
            item
        ).strip()

        if text:
            cleaned.append(
                text
            )

    return cleaned


def normalize_result(
    result: dict[str, Any],
) -> dict[str, Any]:

    summary = result.get(
        "summary",
        "",
    )

    if not isinstance(
        summary,
        str,
    ):
        summary = str(
            summary
        )

    return {
        "summary": summary.strip(),

        "added": clean_list(
            result.get("added")
        ),

        "removed": clean_list(
            result.get("removed")
        ),

        "modified": clean_list(
            result.get("modified")
        ),

        "similarities": clean_list(
            result.get("similarities")
        ),
    }


# ---------------------------------------------------------
# Gemini comparison
# ---------------------------------------------------------

def generate_comparison(
    document_a: dict[str, Any],
    document_b: dict[str, Any],
    compare_type: str,
    depth: str,
) -> dict[str, Any]:

    prompt = build_compare_prompt(
        document_a=document_a,
        document_b=document_b,
        compare_type=compare_type,
        depth=depth,
    )

    config = types.GenerateContentConfig(
        max_output_tokens=12000,
        response_mime_type="application/json",
    )

    response = None
    last_error: Exception | None = None

    max_attempts = 4

    for attempt in range(
        max_attempts
    ):

        try:
            print(
                "Compare Gemini request "
                f"{attempt + 1}/{max_attempts} "
                f"using model {GEMINI_MODEL}..."
            )

            response = (
                gemini_client
                .models
                .generate_content(
                    model=GEMINI_MODEL,
                    contents=prompt,
                    config=config,
                )
            )

            print(
                "Compare Gemini request succeeded."
            )

            break

        except Exception as error:

            last_error = error

            error_text = str(
                error
            )

            error_upper = error_text.upper()

            print(
                "Compare Gemini error:",
                repr(error),
            )

            retryable = (
                "429" in error_text
                or "RESOURCE_EXHAUSTED"
                in error_upper
                or "503" in error_text
                or "UNAVAILABLE"
                in error_upper
                or "500" in error_text
                or "INTERNAL" in error_upper
                or "DEADLINE" in error_upper
                or "TIMEOUT" in error_upper
            )

            if (
                not retryable
                or attempt == max_attempts - 1
            ):
                break

            delay = min(
                2 ** attempt,
                8,
            )

            print(
                "Comparison Gemini service temporarily "
                f"unavailable. Retrying in {delay}s."
            )

            time.sleep(
                delay
            )

    if response is None:

        diagnostic = (
            str(last_error)
            if last_error
            else "Unknown Gemini error."
        )

        print(
            "Compare Gemini final failure:",
            diagnostic,
        )

        raise RuntimeError(
            "Comparison AI service failed. "
            f"Gemini response: {diagnostic}"
        )

    text = getattr(
        response,
        "text",
        None,
    ) or ""

    if not text.strip():

        print(
            "Compare Gemini returned no text."
        )

        raise RuntimeError(
            "Comparison AI returned an empty response."
        )

    result = extract_json(
        text
    )

    return normalize_result(
        result
    )


# ---------------------------------------------------------
# Compare endpoint
# ---------------------------------------------------------

@router.post("")
async def compare(
    request: CompareRequest,
    authorization: str | None = Header(
        default=None
    ),
):
    # -----------------------------------------------------
    # Authentication
    # -----------------------------------------------------

    try:
        user = get_authenticated_user(
            authorization
        )

    except HTTPException:
        raise

    except Exception as error:
        print(
            "Compare authentication error:",
            repr(error),
        )

        raise HTTPException(
            status_code=401,
            detail="Authentication failed.",
        ) from error


    # -----------------------------------------------------
    # Validate document selection
    # -----------------------------------------------------

    if (
        request.document_a_id
        == request.document_b_id
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Document A and Document B "
                "must be different."
            ),
        )


    # -----------------------------------------------------
    # Validate comparison type
    # -----------------------------------------------------

    if (
        request.compare_type
        not in VALID_COMPARE_TYPES
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid comparison type.",
        )


    # -----------------------------------------------------
    # Validate depth
    # -----------------------------------------------------

    if (
        request.depth
        not in VALID_DEPTHS
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid comparison depth.",
        )


    # -----------------------------------------------------
    # Load profile
    # -----------------------------------------------------

    try:
        profile_result = (
            supabase
            .table("profiles")
            .select("plan")
            .eq(
                "id",
                str(user.id),
            )
            .single()
            .execute()
        )

    except Exception as error:
        print(
            "Compare profile lookup error:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to verify your account plan."
            ),
        ) from error


    profile = (
        profile_result.data
        or {}
    )


    plan = profile.get(
        "plan",
        "free",
    )


    # -----------------------------------------------------
    # Pro access
    # -----------------------------------------------------

    if plan not in {
        "pro",
        "business",
    }:
        raise HTTPException(
            status_code=403,
            detail=(
                "Document Comparison requires "
                "the Pro plan or higher."
            ),
        )


    # -----------------------------------------------------
    # Load documents
    # -----------------------------------------------------

    document_a = load_document(
        user_id=str(user.id),
        document_id=request.document_a_id,
    )


    document_b = load_document(
        user_id=str(user.id),
        document_id=request.document_b_id,
    )


    # -----------------------------------------------------
    # Generate comparison
    # -----------------------------------------------------

    try:

        result = generate_comparison(
            document_a=document_a,
            document_b=document_b,
            compare_type=request.compare_type,
            depth=request.depth,
        )

    except RuntimeError as error:

        print(
            "Compare service error:",
            repr(error),
        )

        raise HTTPException(
            status_code=502,
            detail=str(error),
        ) from error

    except Exception as error:

        print(
            "Unexpected compare error:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "An unexpected comparison "
                "error occurred."
            ),
        ) from error


    # -----------------------------------------------------
    # Response
    # -----------------------------------------------------

    return {
        "success": True,

        "summary": result[
            "summary"
        ],

        "added": result[
            "added"
        ],

        "removed": result[
            "removed"
        ],

        "modified": result[
            "modified"
        ],

        "similarities": result[
            "similarities"
        ],

        "compare_type": request.compare_type,

        "depth": request.depth,

        "document_a": {
            "id": document_a[
                "id"
            ],
            "name": document_a[
                "name"
            ],
        },

        "document_b": {
            "id": document_b[
                "id"
            ],
            "name": document_b[
                "name"
            ],
        },
    }