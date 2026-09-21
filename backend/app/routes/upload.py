import os
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    File,
    Header,
    HTTPException,
    UploadFile,
)
from supabase import create_client

from app.services.embeddings import generate_embedding
from app.services.rag import chunk_text, extract_text

load_dotenv()


router = APIRouter(
    prefix="/upload",
    tags=["Upload"],
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
# FILE TYPES
# ============================================================

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".txt",
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


def sanitize_filename(
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


def create_unique_temp_path(
    filename: str,
) -> Path:

    extension = (
        Path(filename)
        .suffix
        .lower()
    )

    return (
        UPLOAD_DIR
        / (
            f"upload_"
            f"{uuid.uuid4().hex}"
            f"{extension}"
        )
    )


# ============================================================
# AUTHENTICATION
# ============================================================

def get_authenticated_user(
    authorization: Optional[str],
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
        )

    if not authorization.startswith(
        "Bearer "
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header.",
        )

    token = authorization.replace(
        "Bearer ",
        "",
        1,
    ).strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token.",
        )

    try:
        response = (
            supabase.auth.get_user(
                token
            )
        )

        user = response.user

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session.",
        )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session.",
        )

    return user


# ============================================================
# CREATE SIGNED URL
# ============================================================

def create_signed_url(
    storage_path: str,
    expires_in: int = 300,
) -> Optional[str]:

    if not storage_path:
        return None

    try:
        result = (
            supabase
            .storage
            .from_(SUPABASE_BUCKET)
            .create_signed_url(
                storage_path,
                expires_in,
            )
        )

        if isinstance(result, dict):
            return result.get(
                "signedURL"
            )

        return None

    except Exception:
        return None


# ============================================================
# UPLOAD DOCUMENT
# ============================================================

@router.post("/")
async def upload_document(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_authenticated_user(
        authorization
    )

    original_filename = (
        file.filename
        or "document"
    )

    safe_filename = sanitize_filename(
        original_filename
    )

    extension = (
        Path(safe_filename)
        .suffix
        .lower()
    )

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Supported document types are "
                "PDF, DOCX, and TXT."
            ),
        )

    temp_path = create_unique_temp_path(
        safe_filename
    )

    document_id: Optional[str] = None
    storage_path: Optional[str] = None

    try:
        # ====================================================
        # SAVE TEMP FILE
        # ====================================================

        with temp_path.open(
            "wb"
        ) as destination:

            while True:
                chunk = await file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                destination.write(
                    chunk
                )

        await file.close()

        if not temp_path.exists():
            raise RuntimeError(
                "Unable to save uploaded file."
            )

        file_size = (
            temp_path.stat().st_size
        )

        if file_size <= 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        # ====================================================
        # EXTRACT TEXT
        # ====================================================

        try:
            text = extract_text(
                str(temp_path)
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    "We could not read this document. "
                    "Please verify that the file is valid."
                ),
            ) from exc

        word_count = (
            len(text.split())
            if text
            else 0
        )

        # ====================================================
        # CREATE DOCUMENT RECORD
        # ====================================================

        document_record = {
            "user_id": str(user.id),
            "name": safe_filename,
            "file_name": safe_filename,
            "file_type": get_content_type(
                extension
            ),
            "file_size": file_size,
            "status": "processing",
            "word_count": word_count,
        }

        insert_result = (
            supabase
            .table("documents")
            .insert(
                document_record
            )
            .execute()
        )

        inserted_rows = (
            insert_result.data or []
        )

        if not inserted_rows:
            raise RuntimeError(
                "Unable to create document record."
            )

        document_id = str(
            inserted_rows[0]["id"]
        )

        # ====================================================
        # STORAGE PATH
        # ====================================================

        storage_path = (
            f"{user.id}/"
            f"{document_id}/"
            f"{safe_filename}"
        )

        file_bytes = (
            temp_path.read_bytes()
        )

        # ====================================================
        # UPLOAD TO STORAGE
        # ====================================================

        supabase.storage.from_(
            SUPABASE_BUCKET
        ).upload(
            storage_path,
            file_bytes,
            {
                "content-type": get_content_type(
                    extension
                ),
                "upsert": False,
            },
        )

        # ====================================================
        # UPDATE STORAGE PATH
        # ====================================================

        (
            supabase
            .table("documents")
            .update(
                {
                    "storage_path": storage_path,
                }
            )
            .eq(
                "id",
                document_id,
            )
            .eq(
                "user_id",
                str(user.id),
            )
            .execute()
        )

        # ====================================================
        # CREATE RAG CHUNKS
        # ====================================================

        chunks = chunk_text(
            text
        )

        for chunk in chunks:
            try:
                embedding = (
                    await generate_embedding(
                        chunk
                    )
                )
            except Exception:
                # Do not allow one embedding failure to
                # destroy the user's uploaded document.
                continue

            if not embedding:
                continue

            try:
                (
                    supabase
                    .table("document_chunks")
                    .insert(
                        {
                            "document_id": document_id,
                            "content": chunk,
                            "embedding": embedding,
                        }
                    )
                    .execute()
                )
            except Exception:
                # Chunk indexing failure must not invalidate
                # the uploaded source document.
                continue

        # ====================================================
        # MARK READY
        # ====================================================

        (
            supabase
            .table("documents")
            .update(
                {
                    "status": "ready",
                }
            )
            .eq(
                "id",
                document_id,
            )
            .eq(
                "user_id",
                str(user.id),
            )
            .execute()
        )

        # ====================================================
        # PREVIEW URL
        # ====================================================

        preview_url = create_signed_url(
            storage_path,
            expires_in=300,
        )

        return {
            "success": True,
            "document_id": document_id,
            "filename": safe_filename,
            "file_type": get_content_type(
                extension
            ),
            "file_size": file_size,
            "word_count": word_count,
            "status": "ready",
            "preview_url": preview_url,
        }

    except HTTPException:
        raise

    except Exception:
        # ====================================================
        # CLEAN DATABASE
        # ====================================================

        if document_id:
            try:
                (
                    supabase
                    .table("document_chunks")
                    .delete()
                    .eq(
                        "document_id",
                        document_id,
                    )
                    .execute()
                )
            except Exception:
                pass

            try:
                (
                    supabase
                    .table("documents")
                    .delete()
                    .eq(
                        "id",
                        document_id,
                    )
                    .eq(
                        "user_id",
                        str(user.id),
                    )
                    .execute()
                )
            except Exception:
                pass

        # ====================================================
        # CLEAN STORAGE
        # ====================================================

        if storage_path:
            try:
                (
                    supabase
                    .storage
                    .from_(SUPABASE_BUCKET)
                    .remove(
                        [storage_path]
                    )
                )
            except Exception:
                pass

        raise HTTPException(
            status_code=500,
            detail=(
                "The document could not be uploaded. "
                "Please try again."
            ),
        )

    finally:
        # ====================================================
        # DELETE TEMP FILE
        # ====================================================

        try:
            if temp_path.exists():
                temp_path.unlink()
        except Exception:
            pass


# ============================================================
# LIST MY DOCUMENTS
# ============================================================

@router.get("/documents")
async def list_documents(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    """
    Return only documents owned by the authenticated user.

    Used by the Translate page's My Documents selector.
    """

    user = get_authenticated_user(
        authorization
    )

    try:
        result = (
            supabase
            .table("documents")
            .select(
                "id,user_id,name,file_name,file_type,"
                "file_size,status,word_count,storage_path"
            )
            .eq(
                "user_id",
                str(user.id),
            )
            .order(
                "created_at",
                desc=True,
            )
            .execute()
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load your documents."
            ),
        )

    documents = []

    for document in (
        result.data or []
    ):
        # Never expose storage paths to the browser.
        documents.append(
            {
                "id": document.get(
                    "id"
                ),
                "name": document.get(
                    "name"
                ),
                "file_name": document.get(
                    "file_name"
                ),
                "file_type": document.get(
                    "file_type"
                ),
                "file_size": document.get(
                    "file_size"
                ),
                "status": document.get(
                    "status"
                ),
                "word_count": document.get(
                    "word_count"
                ),
            }
        )

    return {
        "success": True,
        "documents": documents,
    }


# ============================================================
# DOCUMENT PREVIEW
# ============================================================

@router.get("/{document_id}/preview")
async def preview_document(
    document_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_authenticated_user(
        authorization
    )

    try:
        result = (
            supabase
            .table("documents")
            .select(
                "id,user_id,file_name,file_type,"
                "storage_path,status"
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

    except Exception:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve the document."
            ),
        )

    rows = result.data or []

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    document = rows[0]

    if not document.get(
        "storage_path"
    ):
        raise HTTPException(
            status_code=404,
            detail=(
                "Document storage is unavailable."
            ),
        )

    signed_url = create_signed_url(
        document["storage_path"],
        expires_in=300,
    )

    if not signed_url:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to create document preview."
            ),
        )

    return {
        "success": True,
        "document_id": document_id,
        "filename": document.get(
            "file_name"
        ),
        "file_type": document.get(
            "file_type"
        ),
        "status": document.get(
            "status"
        ),
        "preview_url": signed_url,
    }


# ============================================================
# DELETE DOCUMENT
# ============================================================

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_authenticated_user(
        authorization
    )

    try:
        result = (
            supabase
            .table("documents")
            .select(
                "id,user_id,storage_path"
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

    except Exception:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve the document."
            ),
        )

    rows = result.data or []

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    document = rows[0]

    # ========================================================
    # DELETE STORAGE
    # ========================================================

    storage_path = document.get(
        "storage_path"
    )

    if storage_path:
        try:
            (
                supabase
                .storage
                .from_(SUPABASE_BUCKET)
                .remove(
                    [storage_path]
                )
            )
        except Exception:
            pass

    # ========================================================
    # DELETE CHUNKS
    # ========================================================

    try:
        (
            supabase
            .table("document_chunks")
            .delete()
            .eq(
                "document_id",
                document_id,
            )
            .execute()
        )
    except Exception:
        pass

    # ========================================================
    # DELETE DOCUMENT
    # ========================================================

    try:
        (
            supabase
            .table("documents")
            .delete()
            .eq(
                "id",
                document_id,
            )
            .eq(
                "user_id",
                str(user.id),
            )
            .execute()
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to delete the document."
            ),
        )

    return {
        "success": True,
        "document_id": document_id,
        "deleted": True,
    }