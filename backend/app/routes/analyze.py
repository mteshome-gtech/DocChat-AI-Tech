import os
import time
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
    Header,
)
from google import genai

from app.routes.upload import (
    get_authenticated_user,
    supabase,
    SUPABASE_BUCKET,
)
from app.services.rag import extract_text

load_dotenv()


router = APIRouter(
    prefix="/analyze",
    tags=["Analyze"],
)


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.7-flash",
)


if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not configured."
    )


client = genai.Client(
    api_key=GEMINI_API_KEY
)


ANALYSIS_INSTRUCTIONS = {
    "executive_summary": (
        "Create a concise executive summary covering the "
        "document's purpose, most important points, "
        "conclusions, and implications."
    ),
    "key_findings": (
        "Identify the most important findings, facts, "
        "insights, and takeaways from the document."
    ),
    "detailed_summary": (
        "Create a detailed but well-organized summary "
        "of the document, covering all major sections "
        "and important information."
    ),
    "risks": (
        "Identify risks, red flags, potential problems, "
        "vulnerabilities, uncertainties, and negative "
        "consequences."
    ),
    "obligations": (
        "Identify obligations, responsibilities, "
        "commitments, requirements, and parties "
        "responsible for them."
    ),
    "important_dates": (
        "Identify every important date, deadline, "
        "effective date, renewal date, expiration date, "
        "milestone, or time-sensitive requirement."
    ),
    "contradictions": (
        "Identify contradictions, inconsistencies, "
        "conflicting statements, or information that "
        "appears to disagree."
    ),
    "missing_information": (
        "Identify important information that appears "
        "to be missing, unclear, incomplete, or "
        "insufficiently explained."
    ),
    "legal_review": (
        "Review the document for potentially important "
        "legal terms, clauses, rights, responsibilities, "
        "liabilities, restrictions, and concerns. "
        "Do not present this as legal advice."
    ),
    "compliance": (
        "Identify compliance requirements, policies, "
        "standards, controls, regulatory considerations, "
        "and potential compliance gaps."
    ),
    "financial": (
        "Identify and analyze important financial "
        "information, amounts, costs, revenue, expenses, "
        "financial obligations, assumptions, and "
        "financial risks."
    ),
    "opportunities": (
        "Identify opportunities, potential improvements, "
        "growth areas, efficiencies, advantages, and "
        "actionable opportunities."
    ),
    "strengths_weaknesses": (
        "Identify the major strengths and weaknesses "
        "demonstrated by the document, organization, "
        "proposal, or situation."
    ),
    "recommendations": (
        "Provide practical recommendations based "
        "strictly on the information contained in "
        "the document."
    ),
    "action_items": (
        "Identify concrete action items, who appears "
        "responsible when stated, and relevant "
        "deadlines or priorities."
    ),
    "entities": (
        "Identify important people, organizations, "
        "companies, products, locations, projects, "
        "and other key entities and explain their role."
    ),
}


def build_prompt(
    analysis_type: str,
    documents: list[tuple[str, str]],
    custom_prompt: str | None,
) -> str:

    if analysis_type == "custom":
        instruction = custom_prompt or (
            "Analyze the documents and provide the "
            "most useful insights."
        )
    else:
        instruction = ANALYSIS_INSTRUCTIONS.get(
            analysis_type
        )

        if not instruction:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unsupported analysis type: "
                    f"{analysis_type}"
                ),
            )

    document_sections = []

    for filename, text in documents:
        document_sections.append(
            f"""
===== DOCUMENT: {filename} =====

{text}

"""
        )

    combined_documents = "\n".join(
        document_sections
    )

    return f"""
You are DocChat AI's document analysis engine.

Analyze the provided document(s) using ONLY the
information contained in the supplied documents.

Analysis requested:

{instruction}

Important requirements:

- Do not invent facts.
- If information is unavailable, explicitly say so.
- Clearly distinguish facts from reasonable interpretations.
- Use headings and bullet points where useful.
- Make the response easy to scan.
- If multiple documents are provided, compare information
  across them when relevant.
- Reference the document filename when useful.
- Do not claim to have performed actions you did not perform.

Documents:

{combined_documents}

"""


@router.post("")
async def analyze_documents(
    files: list[UploadFile] = File(default=[]),
    analysis_type: str = Form(...),
    custom_prompt: str | None = Form(default=None),
    document_id: str | None = Form(default=None),
    authorization: str | None = Header(default=None),
):
    """
    Analyze one or more newly uploaded documents and/or
    an existing saved document from the user's Documents
    library with Gemini.
    """

    user = get_authenticated_user(
        authorization
    )

    if not files and not document_id:
        raise HTTPException(
            status_code=400,
            detail="At least one document is required.",
        )

    allowed_extensions = {
        ".pdf",
        ".docx",
        ".txt",
    }

    documents: list[tuple[str, str]] = []
    temporary_files: list[Path] = []

    try:

        # -------------------------------------------------
        # Process an existing saved document
        # -------------------------------------------------

        if document_id:

            document_result = (
                supabase
                .table("documents")
                .select(
                    "id, user_id, name, file_name, "
                    "file_type, storage_path, status"
                )
                .eq(
                    "id",
                    document_id,
                )
                .eq(
                    "user_id",
                    str(user.id),
                )
                .limit(1)
                .execute()
            )

            saved_documents = (
                document_result.data or []
            )

            if not saved_documents:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "The selected document was not "
                        "found in your Documents."
                    ),
                )

            saved_document = saved_documents[0]

            storage_path = saved_document.get(
                "storage_path"
            )

            if not storage_path:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "The selected document does not "
                        "have an available stored file."
                    ),
                )

            try:
                saved_file_bytes = (
                    supabase
                    .storage
                    .from_(
                        SUPABASE_BUCKET
                    )
                    .download(
                        storage_path
                    )
                )

            except Exception as storage_error:

                print(
                    "Saved document download error:",
                    storage_error,
                )

                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Unable to retrieve the selected "
                        "document from storage."
                    ),
                )

            if not saved_file_bytes:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "The selected document file "
                        "could not be retrieved."
                    ),
                )

            saved_filename = (
                saved_document.get("file_name")
                or saved_document.get("name")
                or "document"
            )

            saved_extension = Path(
                saved_filename
            ).suffix.lower()

            if saved_extension not in allowed_extensions:

                saved_file_type = (
                    saved_document.get("file_type")
                    or ""
                ).lower()

                if saved_file_type in {
                    "pdf",
                    ".pdf",
                }:
                    saved_extension = ".pdf"

                elif saved_file_type in {
                    "docx",
                    ".docx",
                }:
                    saved_extension = ".docx"

                elif saved_file_type in {
                    "txt",
                    ".txt",
                }:
                    saved_extension = ".txt"

            if saved_extension not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "The selected saved document "
                        "is not a supported PDF, DOCX, "
                        "or TXT file."
                    ),
                )

            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=saved_extension,
            ) as temp_file:

                temp_path = Path(
                    temp_file.name
                )

                temp_file.write(
                    saved_file_bytes
                )

            temporary_files.append(
                temp_path
            )

            saved_text = extract_text(
                str(temp_path)
            )

            if not saved_text:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"No readable text was found "
                        f"in {saved_filename}."
                    ),
                )

            documents.append(
                (
                    saved_filename,
                    saved_text,
                )
            )

        # -------------------------------------------------
        # Process newly uploaded documents
        # -------------------------------------------------

        for file in files:

            if not file.filename:
                raise HTTPException(
                    status_code=400,
                    detail="A filename is required.",
                )

            extension = Path(
                file.filename
            ).suffix.lower()

            if extension not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Only PDF, DOCX, and TXT files "
                        "are supported."
                    ),
                )

            safe_filename = Path(
                file.filename
            ).name

            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=extension,
            ) as temp_file:

                temp_path = Path(
                    temp_file.name
                )

                while True:

                    chunk = await file.read(
                        1024 * 1024
                    )

                    if not chunk:
                        break

                    temp_file.write(
                        chunk
                    )

            temporary_files.append(
                temp_path
            )

            text = extract_text(
                str(temp_path)
            )

            if not text:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"No readable text was found "
                        f"in {safe_filename}."
                    ),
                )

            documents.append(
                (
                    safe_filename,
                    text,
                )
            )

        if not documents:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No readable documents were "
                    "available for analysis."
                ),
            )

        # -------------------------------------------------
        # Build Gemini prompt
        # -------------------------------------------------

        prompt = build_prompt(
            analysis_type=analysis_type,
            documents=documents,
            custom_prompt=custom_prompt,
        )

        # -------------------------------------------------
        # Call Gemini with retry handling
        # -------------------------------------------------

        response = None
        last_error = None

        for attempt in range(4):

            try:

                print(
                    f"Gemini analysis attempt "
                    f"{attempt + 1}/4..."
                )

                response = (
                    client.models.generate_content(
                        model=GEMINI_MODEL,
                        contents=prompt,
                    )
                )

                break

            except Exception as error:

                last_error = error
                error_text = str(error)

                is_retryable = (
                    "503" in error_text
                    or "UNAVAILABLE"
                    in error_text
                    or "429" in error_text
                    or "RESOURCE_EXHAUSTED"
                    in error_text
                )

                if (
                    not is_retryable
                    or attempt == 3
                ):
                    raise

                delay = 2 ** attempt

                print(
                    "Gemini temporarily unavailable. "
                    f"Retrying in {delay} seconds..."
                )

                time.sleep(delay)

        if response is None:
            raise RuntimeError(
                "Gemini request failed: "
                f"{last_error}"
            )

        # -------------------------------------------------
        # Get Gemini result
        # -------------------------------------------------

        result = response.text

        if not result:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Gemini returned an empty analysis."
                ),
            )

        # -------------------------------------------------
        # Return result to frontend
        # -------------------------------------------------

        return {
            "success": True,
            "analysis_type": analysis_type,
            "result": result,
            "documents": [
                filename
                for filename, _ in documents
            ],
            "document_id": document_id,
            "user_id": str(user.id),
        }

    except HTTPException:
        raise

    except Exception as error:

        print(
            "Analyze error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Analysis failed: {str(error)}"
            ),
        )

    finally:

        # -------------------------------------------------
        # Clean up temporary files
        # -------------------------------------------------

        for temp_path in temporary_files:

            try:

                if temp_path.exists():
                    temp_path.unlink()

            except Exception as cleanup_error:

                print(
                    "Temporary file cleanup error:",
                    cleanup_error,
                )