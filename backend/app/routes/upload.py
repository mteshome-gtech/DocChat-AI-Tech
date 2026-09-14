import os
import shutil
from pathlib import Path

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Header,
)
from supabase import create_client, Client

from app.services.rag import (
    extract_text,
    chunk_text,
)
from app.services.embeddings import (
    generate_embedding,
)

load_dotenv()

router = APIRouter(
    prefix="/upload",
    tags=["Upload"],
)

UPLOAD_DIR = Path("uploads")
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

SUPABASE_STORAGE_BUCKET = os.getenv(
    "SUPABASE_STORAGE_BUCKET",
    "documents",
)

if (
    not SUPABASE_URL
    or not SUPABASE_SERVICE_ROLE_KEY
):
    raise RuntimeError(
        "Supabase environment variables are not configured."
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)


def get_authenticated_user(
    authorization: str | None,
):
    """
    Verify the Supabase access token and return
    the authenticated user's information.
    """

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header is required.",
        )

    if not authorization.startswith(
        "Bearer "
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header.",
        )

    access_token = authorization.replace(
        "Bearer ",
        "",
        1,
    ).strip()

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Access token is missing.",
        )

    try:
        user_response = (
            supabase.auth.get_user(
                access_token
            )
        )

        user = user_response.user

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired session.",
            )

        return user

    except HTTPException:
        raise

    except Exception as error:
        print(
            "Authentication error:",
            error,
        )

        raise HTTPException(
            status_code=401,
            detail=(
                "Invalid or expired "
                "authentication token."
            ),
        )


def get_content_type(
    extension: str,
) -> str:
    content_types = {
        ".pdf": "application/pdf",
        ".docx": (
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
        ".txt": "text/plain",
    }

    return content_types.get(
        extension,
        "application/octet-stream",
    )


@router.post("/")
async def upload_document(
    file: UploadFile = File(...),
    authorization: str | None = Header(
        default=None
    ),
):
    """
    Upload a document.

    The original file is stored in Supabase Storage.
    Extracted text is separately chunked and embedded
    for AI/RAG functionality.
    """

    user = get_authenticated_user(
        authorization
    )

    allowed_extensions = {
        ".pdf",
        ".docx",
        ".txt",
    }

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required.",
        )

    file_extension = Path(
        file.filename
    ).suffix.lower()

    if (
        file_extension
        not in allowed_extensions
    ):
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

    file_path = (
        UPLOAD_DIR / safe_filename
    )

    document_id = None
    storage_path = None
    storage_uploaded = False

    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer,
            )

        file_size = file_path.stat().st_size

        if file_size <= 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        text = extract_text(
            str(file_path)
        )

        if not text:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No readable text was found "
                    "in the document."
                ),
            )

        chunks = chunk_text(text)

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The document could not be "
                    "split into readable chunks."
                ),
            )

        document_result = (
            supabase
            .table("documents")
            .insert(
                {
                    "user_id": str(user.id),
                    "name": safe_filename,
                    "file_name": safe_filename,
                    "file_type": file_extension,
                    "file_size": file_size,
                    "status": "processing",
                    "word_count": len(
                        text.split()
                    ),
                }
            )
            .execute()
        )

        if not document_result.data:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to create "
                    "document record."
                ),
            )

        document = (
            document_result.data[0]
        )

        document_id = document["id"]

        storage_path = (
            f"{str(user.id)}/"
            f"{document_id}/"
            f"{safe_filename}"
        )

        with file_path.open("rb") as uploaded_file:
            file_bytes = uploaded_file.read()

        supabase.storage.from_(
            SUPABASE_STORAGE_BUCKET
        ).upload(
            storage_path,
            file_bytes,
            {
                "content-type": get_content_type(
                    file_extension
                ),
                "upsert": "false",
            },
        )

        storage_uploaded = True

        storage_update = (
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
            .execute()
        )

        if not storage_update.data:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to save document "
                    "storage information."
                ),
            )

        chunk_rows = []

        for index, chunk in enumerate(
            chunks
        ):
            print(
                f"[EMBEDDING] "
                f"Document={document_id} "
                f"Chunk={index + 1}/{len(chunks)}"
            )

            embedding = (
                await generate_embedding(
                    chunk
                )
            )

            chunk_rows.append(
                {
                    "document_id": document_id,
                    "chunk_index": index,
                    "content": chunk,
                    "embedding": embedding,
                }
            )

        chunk_result = (
            supabase
            .table("document_chunks")
            .insert(chunk_rows)
            .execute()
        )

        if not chunk_result.data:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to create "
                    "document chunks."
                ),
            )

        supabase \
            .table("documents") \
            .update(
                {
                    "status": "ready",
                }
            ) \
            .eq(
                "id",
                document_id,
            ) \
            .execute()

        print(
            f"[UPLOAD] "
            f"Document={document_id} "
            f"Chunks={len(chunks)} "
            f"Storage={storage_path} "
            f"Status=ready"
        )

        return {
            "message": (
                "Document uploaded "
                "and indexed successfully."
            ),
            "document_id": document_id,
            "user_id": str(user.id),
            "filename": safe_filename,
            "chunks": len(chunks),
            "words": len(text.split()),
            "embedded": True,
            "stored": True,
        }

    except HTTPException:
        if document_id:
            try:
                supabase \
                    .table("document_chunks") \
                    .delete() \
                    .eq(
                        "document_id",
                        document_id,
                    ) \
                    .execute()

                supabase \
                    .table("documents") \
                    .delete() \
                    .eq(
                        "id",
                        document_id,
                    ) \
                    .execute()

            except Exception as cleanup_error:
                print(
                    "Database cleanup error:",
                    cleanup_error,
                )

        if (
            storage_uploaded
            and storage_path
        ):
            try:
                supabase.storage.from_(
                    SUPABASE_STORAGE_BUCKET
                ).remove(
                    [storage_path]
                )
            except Exception as storage_cleanup_error:
                print(
                    "Storage cleanup error:",
                    storage_cleanup_error,
                )

        raise

    except Exception as error:
        print(
            "Upload error:",
            error,
        )

        if document_id:
            try:
                supabase \
                    .table("document_chunks") \
                    .delete() \
                    .eq(
                        "document_id",
                        document_id,
                    ) \
                    .execute()

                supabase \
                    .table("documents") \
                    .delete() \
                    .eq(
                        "id",
                        document_id,
                    ) \
                    .execute()

            except Exception as cleanup_error:
                print(
                    "Cleanup error:",
                    cleanup_error,
                )

        if (
            storage_uploaded
            and storage_path
        ):
            try:
                supabase.storage.from_(
                    SUPABASE_STORAGE_BUCKET
                ).remove(
                    [storage_path]
                )
            except Exception as storage_cleanup_error:
                print(
                    "Storage cleanup error:",
                    storage_cleanup_error,
                )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Upload failed: {str(error)}"
            ),
        )

    finally:
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception as cleanup_error:
                print(
                    "Temporary file cleanup error:",
                    cleanup_error,
                )


@router.get("/{document_id}/preview")
async def get_document_preview(
    document_id: str,
    authorization: str | None = Header(
        default=None
    ),
):
    """
    Generate a short-lived signed URL for the
    original uploaded document.
    """

    user = get_authenticated_user(
        authorization
    )

    try:
        document_result = (
            supabase
            .table("documents")
            .select(
                "id, user_id, name, file_name, "
                "file_type, storage_path"
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

        documents = (
            document_result.data or []
        )

        if not documents:
            raise HTTPException(
                status_code=404,
                detail="Document not found.",
            )

        document = documents[0]

        storage_path = document.get(
            "storage_path"
        )

        if not storage_path:
            raise HTTPException(
                status_code=404,
                detail=(
                    "The original file is not "
                    "available for preview."
                ),
            )

        signed_result = (
            supabase.storage
            .from_(
                SUPABASE_STORAGE_BUCKET
            )
            .create_signed_url(
                storage_path,
                300,
            )
        )

        signed_url = None

        if isinstance(
            signed_result,
            dict,
        ):
            signed_url = (
                signed_result.get(
                    "signedURL"
                )
                or signed_result.get(
                    "signedUrl"
                )
            )

        if not signed_url:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to create a secure "
                    "document preview URL."
                ),
            )

        return {
            "success": True,
            "document_id": document_id,
            "filename": (
                document.get("name")
                or document.get("file_name")
            ),
            "file_type": document.get(
                "file_type"
            ),
            "url": signed_url,
            "expires_in": 300,
        }

    except HTTPException:
        raise

    except Exception as error:
        print(
            "Preview URL error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to create document preview."
            ),
        )


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    authorization: str | None = Header(
        default=None
    ),
):
    """
    Delete the original file, indexed chunks,
    and document database record.
    """

    user = get_authenticated_user(
        authorization
    )

    try:
        document_result = (
            supabase
            .table("documents")
            .select(
                "id, user_id, storage_path"
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

        documents = (
            document_result.data or []
        )

        if not documents:
            raise HTTPException(
                status_code=404,
                detail="Document not found.",
            )

        document = documents[0]

        storage_path = document.get(
            "storage_path"
        )

        if storage_path:
            try:
                supabase.storage.from_(
                    SUPABASE_STORAGE_BUCKET
                ).remove(
                    [storage_path]
                )
            except Exception as storage_error:
                print(
                    "Storage deletion warning:",
                    storage_error,
                )

        supabase \
            .table("document_chunks") \
            .delete() \
            .eq(
                "document_id",
                document_id,
            ) \
            .execute()

        document_delete = (
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

        if not document_delete.data:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to delete "
                    "document record."
                ),
            )

        print(
            f"[DELETE] "
            f"Document={document_id} "
            f"User={user.id}"
        )

        return {
            "success": True,
            "document_id": document_id,
            "deleted": True,
        }

    except HTTPException:
        raise

    except Exception as error:
        print(
            "Delete document error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to delete document."
            ),
        )