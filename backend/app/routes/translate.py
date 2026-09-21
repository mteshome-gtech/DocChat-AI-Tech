import asyncio
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
)
from supabase import create_client

from app.routes.upload import get_authenticated_user
from app.services.rag import chunk_text, extract_text
from app.services.translation import (
    TranslationError,
    TranslationQuotaError,
    create_translated_pdf,
    extract_pdf_blocks,
    translate_blocks,
    translate_text,
)

load_dotenv()


router = APIRouter(
    prefix="/translate",
    tags=["Translation"],
)


# ============================================================
# CONFIGURATION
# ============================================================

UPLOAD_DIR = Path(
    os.getenv("UPLOAD_DIR", "uploads")
)

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


SUPABASE_URL = os.getenv(
    "SUPABASE_URL"
)

SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)

SUPABASE_BUCKET = os.getenv(
    "SUPABASE_BUCKET",
    "documents",
)


if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL is not configured."
    )

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
    )


supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)


# ============================================================
# FILE HELPERS
# ============================================================

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".docx",
}


def get_content_type(
    extension: str,
) -> str:

    mapping = {
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".docx": (
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
    }

    return mapping.get(
        extension.lower(),
        "application/octet-stream",
    )


def safe_filename(
    filename: str,
) -> str:

    original = Path(
        filename or "document"
    ).name

    stem = Path(original).stem
    suffix = Path(original).suffix.lower()

    safe_stem = "".join(
        character
        for character in stem
        if character.isalnum()
        or character in (
            " ",
            "-",
            "_",
            ".",
        )
    ).strip()

    if not safe_stem:
        safe_stem = "document"

    return f"{safe_stem}{suffix}"


def create_temp_path(
    prefix: str,
    extension: str,
) -> Path:

    return (
        UPLOAD_DIR
        / f"{prefix}_{uuid.uuid4().hex}{extension}"
    )


def create_signed_url(
    storage_path: str,
    expires_in: int = 3600,
) -> Optional[str]:

    if not storage_path:
        return None

    try:
        result = supabase.storage.from_(
            SUPABASE_BUCKET
        ).create_signed_url(
            storage_path,
            expires_in,
        )

        if isinstance(result, dict):
            return result.get("signedURL")

        return None

    except Exception:
        return None


# ============================================================
# STORAGE DOWNLOAD
# ============================================================

def download_storage_file(
    storage_path: str,
    destination: Path,
) -> None:

    if not storage_path:
        raise RuntimeError(
            "The source document does not have a storage path."
        )

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    try:
        data = supabase.storage.from_(
            SUPABASE_BUCKET
        ).download(
            storage_path
        )

    except Exception as exc:
        raise RuntimeError(
            "Unable to download the source document."
        ) from exc

    if not data:
        raise RuntimeError(
            "The source document is empty."
        )

    destination.write_bytes(data)


# ============================================================
# DOCUMENT LOOKUP
# ============================================================

def get_user_document(
    document_id: str,
    user_id: str,
) -> dict:

    try:
        result = (
            supabase
            .table("documents")
            .select(
                "id,user_id,name,file_name,file_type,"
                "file_size,status,word_count,storage_path"
            )
            .eq(
                "id",
                document_id,
            )
            .eq(
                "user_id",
                user_id,
            )
            .limit(1)
            .execute()
        )

    except Exception as exc:
        raise RuntimeError(
            "Unable to retrieve the selected document."
        ) from exc

    rows = result.data or []

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    document = rows[0]

    if not document.get("storage_path"):
        raise HTTPException(
            status_code=400,
            detail="The selected document is not available for translation.",
        )

    return document


# ============================================================
# TEXT EXTRACTION FOR INDEXING
# ============================================================

def _extract_translated_text(
    file_path: str,
) -> str:

    try:
        return extract_text(
            file_path
        )

    except Exception:
        return ""


# ============================================================
# BACKGROUND RAG INDEXING
# ============================================================

def _index_translated_document(
    document_id: str,
    translated_file_path: str,
) -> None:
    """
    Index the translated document after the translated file
    has already been successfully saved.

    Translation delivery does NOT depend on this operation.
    """

    try:
        text = _extract_translated_text(
            translated_file_path
        )

        if not text:
            return

        chunks = chunk_text(
            text,
            chunk_size=1500,
            overlap=200,
        )

        if not chunks:
            return

        # ----------------------------------------------------
        # Import here intentionally.
        #
        # This prevents embedding dependencies from becoming
        # part of the translation request startup path.
        # ----------------------------------------------------

        from app.services.embeddings import generate_embedding

        rows = []

        for chunk in chunks:
            try:
                embedding = asyncio.run(
                    generate_embedding(chunk)
                )
            except Exception:
                # A failed embedding must never make the
                # translation itself fail.
                continue

            if not embedding:
                continue

            rows.append(
                {
                    "document_id": document_id,
                    "content": chunk,
                    "embedding": embedding,
                }
            )

        if rows:
            supabase.table(
                "document_chunks"
            ).insert(
                rows
            ).execute()

    except Exception:
        # Indexing is non-critical after translation.
        #
        # Do not delete the translated document.
        # Do not mark the document failed.
        #
        # A future durable worker can retry this operation.
        return


# ============================================================
# TEXT TRANSLATION
# ============================================================

@router.post("/text")
async def translate_plain_text(
    text: str = Form(...),
    source_language: str = Form(...),
    target_language: str = Form(...),
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_authenticated_user(
        authorization
    )

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty.",
        )

    if not source_language.strip():
        raise HTTPException(
            status_code=400,
            detail="Source language is required.",
        )

    if not target_language.strip():
        raise HTTPException(
            status_code=400,
            detail="Target language is required.",
        )

    try:
        translated = translate_text(
            text=text,
            source_language=source_language,
            target_language=target_language,
        )

    except TranslationQuotaError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Translation is temporarily unavailable. "
                "Please try again shortly."
            ),
        )

    except TranslationError:
        raise HTTPException(
            status_code=502,
            detail=(
                "The translation service could not complete "
                "this request."
            ),
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Translation failed.",
        )

    return {
        "success": True,
        "translated_text": translated,
    }


# ============================================================
# DOCUMENT TRANSLATION
# ============================================================

@router.post("/document")
async def translate_document(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(
        default=None
    ),
    document_id: Optional[str] = Form(
        default=None
    ),
    source_language: str = Form(...),
    target_language: str = Form(...),
    save_to_account: bool = Form(
        default=True
    ),
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_authenticated_user(
        authorization
    )

    # --------------------------------------------------------
    # Validate request.
    #
    # Exactly one source is required:
    #   - uploaded file
    #   - existing document
    # --------------------------------------------------------

    if not file and not document_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Upload a document or select a document "
                "from My Documents."
            ),
        )

    if file and document_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Choose either an uploaded document or "
                "an existing document, not both."
            ),
        )

    if not source_language.strip():
        raise HTTPException(
            status_code=400,
            detail="Source language is required.",
        )

    if not target_language.strip():
        raise HTTPException(
            status_code=400,
            detail="Target language is required.",
        )

    # --------------------------------------------------------
    # Temp files.
    # --------------------------------------------------------

    input_path: Optional[Path] = None
    output_path: Optional[Path] = None

    source_name = "document"
    source_extension = ""

    translated_document_id: Optional[str] = None

    try:
        # ====================================================
        # SOURCE: EXISTING DOCUMENT
        # ====================================================

        if document_id:

            document = get_user_document(
                document_id=document_id,
                user_id=str(user.id),
            )

            source_name = (
                document.get("file_name")
                or document.get("name")
                or "document"
            )

            source_extension = (
                Path(source_name)
                .suffix
                .lower()
            )

            if source_extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "This document type is not supported "
                        "for translation."
                    ),
                )

            input_path = create_temp_path(
                "translation_input",
                source_extension,
            )

            download_storage_file(
                document["storage_path"],
                input_path,
            )

        # ====================================================
        # SOURCE: NEW UPLOAD
        # ====================================================

        else:

            assert file is not None

            source_name = safe_filename(
                file.filename or "document"
            )

            source_extension = (
                Path(source_name)
                .suffix
                .lower()
            )

            if source_extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Supported document types are PDF, "
                        "DOCX, and TXT."
                    ),
                )

            input_path = create_temp_path(
                "translation_input",
                source_extension,
            )

            with input_path.open(
                "wb"
            ) as destination:

                while True:
                    chunk = await file.read(
                        1024 * 1024
                    )

                    if not chunk:
                        break

                    destination.write(chunk)

            await file.close()

        # ----------------------------------------------------
        # Verify input.
        # ----------------------------------------------------

        if not input_path.exists():
            raise RuntimeError(
                "The source document could not be prepared."
            )

        if input_path.stat().st_size <= 0:
            raise HTTPException(
                status_code=400,
                detail="The source document is empty.",
            )

        # ====================================================
        # TRANSLATE
        # ====================================================

        if source_extension == ".pdf":

            blocks, page_data = extract_pdf_blocks(
                str(input_path)
            )

            if not blocks:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "This PDF does not contain extractable "
                        "text. Scanned/image-only PDFs require "
                        "OCR before translation."
                    ),
                )

            translated_blocks = translate_blocks(
                blocks=blocks,
                source_language=source_language,
                target_language=target_language,
            )

            output_name = (
                f"{Path(source_name).stem}"
                f"_{target_language.lower().replace(' ', '_')}"
                f"_translated.pdf"
            )

            output_path = create_temp_path(
                "translation_output",
                ".pdf",
            )

            create_translated_pdf(
                original_file_path=str(input_path),
                translated_blocks=translated_blocks,
                output_file_path=str(output_path),
                target_language=target_language,
            )

        # ====================================================
        # TEXT
        # ====================================================

        elif source_extension == ".txt":

            original_text = input_path.read_text(
                encoding="utf-8",
                errors="ignore",
            )

            if not original_text.strip():
                raise HTTPException(
                    status_code=400,
                    detail="The text document is empty.",
                )

            translated_text = translate_text(
                text=original_text,
                source_language=source_language,
                target_language=target_language,
            )

            output_name = (
                f"{Path(source_name).stem}"
                f"_{target_language.lower().replace(' ', '_')}"
                f"_translated.txt"
            )

            output_path = create_temp_path(
                "translation_output",
                ".txt",
            )

            output_path.write_text(
                translated_text,
                encoding="utf-8",
            )

        # ====================================================
        # DOCX
        # ====================================================

        elif source_extension == ".docx":

            raise HTTPException(
                status_code=400,
                detail=(
                    "DOCX translation is not enabled yet because "
                    "preserving Word layout, tables, images, and "
                    "styles requires the DOCX-specific renderer."
                ),
            )

        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported document type.",
            )

        # ====================================================
        # VERIFY OUTPUT
        # ====================================================

        if not output_path:
            raise RuntimeError(
                "Translation output was not created."
            )

        if not output_path.exists():
            raise RuntimeError(
                "Translation output was not created."
            )

        if output_path.stat().st_size <= 0:
            raise RuntimeError(
                "Translation output is empty."
            )

        # ====================================================
        # SAVE TO MY DOCUMENTS
        # ====================================================

        if not save_to_account:
            return {
                "success": True,
                "filename": output_name,
                "source_language": source_language,
                "target_language": target_language,
                "saved": False,
                "preview_url": None,
                "download_url": None,
            }

        # ----------------------------------------------------
        # Create DB record first.
        # ----------------------------------------------------

        document_record = {
            "user_id": str(user.id),
            "name": output_name,
            "file_name": output_name,
            "file_type": get_content_type(
                output_path.suffix
            ),
            "file_size": output_path.stat().st_size,
            "status": "processing",
            "word_count": 0,
        }

        insert_result = (
            supabase
            .table("documents")
            .insert(document_record)
            .execute()
        )

        inserted_rows = insert_result.data or []

        if not inserted_rows:
            raise RuntimeError(
                "Unable to create the translated document."
            )

        translated_document = inserted_rows[0]

        translated_document_id = str(
            translated_document["id"]
        )

        # ----------------------------------------------------
        # Upload translated file.
        # ----------------------------------------------------

        storage_path = (
            f"{user.id}/"
            f"{translated_document_id}/"
            f"{output_name}"
        )

        file_bytes = output_path.read_bytes()

        supabase.storage.from_(
            SUPABASE_BUCKET
        ).upload(
            storage_path,
            file_bytes,
            {
                "content-type": get_content_type(
                    output_path.suffix
                ),
                "upsert": False,
            },
        )

        # ----------------------------------------------------
        # Mark READY before indexing.
        #
        # This is critical:
        # translation delivery does not wait on embeddings.
        # ----------------------------------------------------

        translated_word_count = 0

        try:
            translated_text_for_count = (
                _extract_translated_text(
                    str(output_path)
                )
            )

            if translated_text_for_count:
                translated_word_count = len(
                    translated_text_for_count.split()
                )

        except Exception:
            translated_word_count = 0

        (
            supabase
            .table("documents")
            .update(
                {
                    "storage_path": storage_path,
                    "file_size": len(file_bytes),
                    "word_count": translated_word_count,
                    "status": "ready",
                }
            )
            .eq(
                "id",
                translated_document_id,
            )
            .eq(
                "user_id",
                str(user.id),
            )
            .execute()
        )

        # ----------------------------------------------------
        # RAG indexing is now NON-BLOCKING.
        # ----------------------------------------------------

        background_tasks.add_task(
            _index_translated_document,
            translated_document_id,
            str(output_path),
        )

        # ----------------------------------------------------
        # Signed URL.
        # ----------------------------------------------------

        signed_url = create_signed_url(
            storage_path,
            expires_in=3600,
        )

        return {
            "success": True,
            "document_id": translated_document_id,
            "filename": output_name,
            "source_language": source_language,
            "target_language": target_language,
            "saved": True,
            "status": "ready",
            "preview_url": signed_url,
            "download_url": signed_url,
        }

    # ========================================================
    # QUOTA ERROR
    # ========================================================

    except TranslationQuotaError:
        # If we created a translated document record but
        # translation failed, clean it up.
        if translated_document_id:
            try:
                supabase.table(
                    "document_chunks"
                ).delete().eq(
                    "document_id",
                    translated_document_id,
                ).execute()

                supabase.table(
                    "documents"
                ).delete().eq(
                    "id",
                    translated_document_id,
                ).eq(
                    "user_id",
                    str(user.id),
                ).execute()

            except Exception:
                pass

        raise HTTPException(
            status_code=503,
            detail=(
                "Translation is temporarily unavailable. "
                "Please try again shortly."
            ),
        )

    # ========================================================
    # TRANSLATION ERROR
    # ========================================================

    except TranslationError:
        if translated_document_id:
            try:
                supabase.table(
                    "documents"
                ).delete().eq(
                    "id",
                    translated_document_id,
                ).eq(
                    "user_id",
                    str(user.id),
                ).execute()
            except Exception:
                pass

        raise HTTPException(
            status_code=502,
            detail=(
                "We couldn't complete the translation. "
                "Your original document was not changed."
            ),
        )

    # ========================================================
    # HTTP ERRORS
    # ========================================================

    except HTTPException:
        raise

    # ========================================================
    # GENERAL ERROR
    # ========================================================

    except Exception:
        if translated_document_id:
            try:
                supabase.table(
                    "document_chunks"
                ).delete().eq(
                    "document_id",
                    translated_document_id,
                ).execute()
            except Exception:
                pass

            try:
                supabase.table(
                    "documents"
                ).delete().eq(
                    "id",
                    translated_document_id,
                ).eq(
                    "user_id",
                    str(user.id),
                ).execute()
            except Exception:
                pass

        raise HTTPException(
            status_code=500,
            detail=(
                "The document could not be translated. "
                "Your original document was not changed."
            ),
        )

    # ========================================================
    # CLEANUP
    # ========================================================

    finally:
        if input_path:
            try:
                if input_path.exists():
                    input_path.unlink()
            except Exception:
                pass

        if output_path:
            try:
                if output_path.exists():
                    output_path.unlink()
            except Exception:
                pass