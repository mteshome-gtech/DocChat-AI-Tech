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
    Form,
)

from supabase import (
    create_client,
    Client,
)

from app.routes.upload import (
    get_authenticated_user,
)

from app.services.translation import (
    translate_text,
    extract_pdf_blocks,
    translate_blocks,
    create_translated_pdf,
)

from app.services.rag import (
    chunk_text,
)

from app.services.embeddings import (
    generate_embedding,
)


load_dotenv()


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/translate",
    tags=["Translation"],
)


# =========================================================
# CONFIG
# =========================================================

UPLOAD_DIR = Path(
    "uploads"
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

SUPABASE_STORAGE_BUCKET = os.getenv(
    "SUPABASE_STORAGE_BUCKET",
    "documents",
)


if (
    not SUPABASE_URL
    or not SUPABASE_SERVICE_ROLE_KEY
):

    raise RuntimeError(
        "Supabase environment variables "
        "are not configured."
    )


supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)


# =========================================================
# HELPERS
# =========================================================

def get_content_type(
    extension: str,
) -> str:

    content_types = {

        ".pdf":
            "application/pdf",

        ".txt":
            "text/plain",

        ".docx":
            (
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
    }

    return content_types.get(
        extension,
        "application/octet-stream",
    )


def create_signed_url(
    storage_path: str,
) -> str:

    result = (
        supabase.storage
        .from_(
            SUPABASE_STORAGE_BUCKET
        )
        .create_signed_url(
            storage_path,
            3600,
        )
    )

    signed_url = None

    if isinstance(
        result,
        dict,
    ):

        signed_url = (
            result.get(
                "signedURL"
            )
            or result.get(
                "signedUrl"
            )
        )

    if not signed_url:

        raise RuntimeError(
            "Failed to create signed URL."
        )

    return signed_url


# =========================================================
# TEXT TRANSLATION
# =========================================================

@router.post("/text")
async def translate_text_endpoint(

    source_language: str = Form(
        "Auto Detect"
    ),

    target_language: str = Form(
        ...
    ),

    text: str = Form(
        ...
    ),

    authorization: str | None = Header(
        default=None
    ),
):

    get_authenticated_user(
        authorization
    )

    if not text.strip():

        raise HTTPException(
            status_code=400,
            detail="Text is required.",
        )

    if not target_language.strip():

        raise HTTPException(
            status_code=400,
            detail="Target language is required.",
        )

    try:

        translated = translate_text(
            text=text,
            source_language=(
                source_language
                or "Auto Detect"
            ),
            target_language=target_language,
        )

        return {

            "success": True,

            "source_language":
                source_language,

            "target_language":
                target_language,

            "original_text":
                text,

            "translated_text":
                translated,
        }

    except Exception as error:

        print(
            "[TEXT TRANSLATION ERROR]",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Translation failed: "
                f"{str(error)}"
            ),
        )


# =========================================================
# DOCUMENT TRANSLATION
# =========================================================

@router.post("/document")
async def translate_document_endpoint(

    file: UploadFile = File(
        ...
    ),

    source_language: str = Form(
        "Auto Detect"
    ),

    target_language: str = Form(
        ...
    ),

    save_to_account: bool = Form(
        True
    ),

    authorization: str | None = Header(
        default=None
    ),
):

    user = get_authenticated_user(
        authorization
    )

    # =====================================================
    # VALIDATE
    # =====================================================

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="Filename is required.",
        )

    safe_filename = Path(
        file.filename
    ).name

    extension = Path(
        safe_filename
    ).suffix.lower()

    allowed_extensions = {
        ".pdf",
        ".txt",
    }

    if extension not in allowed_extensions:

        raise HTTPException(
            status_code=400,
            detail=(
                "Document translation currently "
                "supports PDF and TXT files."
            ),
        )

    if not target_language.strip():

        raise HTTPException(
            status_code=400,
            detail="Target language is required.",
        )

    # =====================================================
    # TEMP FILES
    # =====================================================

    input_path = (
        UPLOAD_DIR
        / (
            "translation_input_"
            f"{safe_filename}"
        )
    )

    output_name = (
        Path(
            safe_filename
        ).stem
        + "_translated"
        + extension
    )

    output_path = (
        UPLOAD_DIR
        / output_name
    )

    translated_document_id = None
    storage_path = None
    storage_uploaded = False

    try:

        # =================================================
        # SAVE INPUT
        # =================================================

        with input_path.open(
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                file.file,
                buffer,
            )

        if input_path.stat().st_size <= 0:

            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        # =================================================
        # PDF TRANSLATION
        # =================================================

        if extension == ".pdf":

            print(
                "[TRANSLATION] "
                f"Extracting PDF: "
                f"{safe_filename}"
            )

            blocks, page_data = (
                extract_pdf_blocks(
                    str(input_path)
                )
            )

            total_pages = len(
                page_data
            )

            print(
                "[TRANSLATION] "
                f"Found {len(blocks)} "
                f"text blocks across "
                f"{total_pages} pages."
            )

            if not blocks:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No readable text was found "
                        "in the PDF."
                    ),
                )

            print(
                "[TRANSLATION] "
                "Starting controlled document "
                "translation..."
            )

            translated_blocks = (
                translate_blocks(
                    blocks=blocks,
                    source_language=(
                        source_language
                        or "Auto Detect"
                    ),
                    target_language=(
                        target_language
                    ),
                )
            )

            print(
                "[TRANSLATION] "
                f"Translated "
                f"{len(translated_blocks)} "
                "blocks."
            )

            print(
                "[TRANSLATION] "
                "Rebuilding translated PDF..."
            )

            create_translated_pdf(
                input_pdf=str(
                    input_path
                ),

                output_pdf=str(
                    output_path
                ),

                translated_blocks=(
                    translated_blocks
                ),

                target_language=(
                    target_language
                ),
            )

            translated_text = (
                "\n".join(
                    block.get(
                        "translated_text",
                        "",
                    )
                    for block
                    in translated_blocks
                )
            )

        # =================================================
        # TXT TRANSLATION
        # =================================================

        else:

            original_text = (
                input_path.read_text(
                    encoding="utf-8"
                )
            )

            if not original_text.strip():

                raise HTTPException(
                    status_code=400,
                    detail="The text file is empty.",
                )

            translated_text = (
                translate_text(
                    text=original_text,

                    source_language=(
                        source_language
                        or "Auto Detect"
                    ),

                    target_language=(
                        target_language
                    ),
                )
            )

            output_path.write_text(
                translated_text,
                encoding="utf-8",
            )

        # =================================================
        # VERIFY OUTPUT
        # =================================================

        if not output_path.exists():

            raise RuntimeError(
                "Translated document was not created."
            )

        file_size = (
            output_path.stat().st_size
        )

        if file_size <= 0:

            raise RuntimeError(
                "Translated document is empty."
            )

        print(
            "[TRANSLATION] "
            f"Output created: "
            f"{output_name}"
        )

        # =================================================
        # SAVE TO ACCOUNT
        # =================================================

        preview_url = None
        download_url = None

        if save_to_account:

            print(
                "[TRANSLATION] "
                "Creating document record..."
            )

            document_result = (
                supabase
                .table("documents")
                .insert(
                    {
                        "user_id":
                            str(user.id),

                        "name":
                            output_name,

                        "file_name":
                            output_name,

                        "file_type":
                            extension,

                        "file_size":
                            file_size,

                        "status":
                            "processing",

                        "word_count":
                            len(
                                translated_text.split()
                            ),
                    }
                )
                .execute()
            )

            if not document_result.data:

                raise RuntimeError(
                    "Failed to create "
                    "translated document record."
                )

            document = (
                document_result.data[0]
            )

            translated_document_id = (
                document["id"]
            )

            # =============================================
            # STORAGE
            # =============================================

            storage_path = (
                f"{str(user.id)}/"
                f"{translated_document_id}/"
                f"{output_name}"
            )

            with output_path.open(
                "rb"
            ) as translated_file:

                file_bytes = (
                    translated_file.read()
                )

            print(
                "[TRANSLATION] "
                "Uploading translated file..."
            )

            supabase.storage.from_(
                SUPABASE_STORAGE_BUCKET
            ).upload(
                storage_path,
                file_bytes,
                {
                    "content-type":
                        get_content_type(
                            extension
                        ),

                    "upsert":
                        "false",
                },
            )

            storage_uploaded = True

            # =============================================
            # SAVE STORAGE PATH
            # =============================================

            storage_update = (
                supabase
                .table("documents")
                .update(
                    {
                        "storage_path":
                            storage_path,
                    }
                )
                .eq(
                    "id",
                    translated_document_id,
                )
                .execute()
            )

            if not storage_update.data:

                raise RuntimeError(
                    "Failed to save "
                    "storage information."
                )

            # =============================================
            # CREATE RAG CHUNKS
            # =============================================

            chunks = chunk_text(
                translated_text
            )

            if chunks:

                chunk_rows = []

                for index, chunk in enumerate(
                    chunks
                ):

                    print(
                        "[TRANSLATION] "
                        f"Embedding chunk "
                        f"{index + 1}/"
                        f"{len(chunks)}"
                    )

                    embedding = (
                        await generate_embedding(
                            chunk
                        )
                    )

                    chunk_rows.append(
                        {
                            "document_id":
                                translated_document_id,

                            "chunk_index":
                                index,

                            "content":
                                chunk,

                            "embedding":
                                embedding,
                        }
                    )

                if chunk_rows:

                    (
                        supabase
                        .table(
                            "document_chunks"
                        )
                        .insert(
                            chunk_rows
                        )
                        .execute()
                    )

            # =============================================
            # MARK READY
            # =============================================

            (
                supabase
                .table("documents")
                .update(
                    {
                        "status":
                            "ready",
                    }
                )
                .eq(
                    "id",
                    translated_document_id,
                )
                .execute()
            )

            print(
                "[TRANSLATION] "
                "Document marked ready."
            )

            # =============================================
            # SIGNED URL
            # =============================================

            preview_url = (
                create_signed_url(
                    storage_path
                )
            )

            download_url = preview_url

        # =================================================
        # SUCCESS
        # =================================================

        return {

            "success":
                True,

            "document_id":
                translated_document_id,

            "filename":
                output_name,

            "source_language":
                source_language,

            "target_language":
                target_language,

            "saved":
                bool(
                    save_to_account
                ),

            "preview_url":
                preview_url,

            "download_url":
                download_url,
        }

    # =====================================================
    # HTTP ERROR
    # =====================================================

    except HTTPException:

        raise

    # =====================================================
    # GENERAL ERROR
    # =====================================================

    except Exception as error:

        print(
            "[DOCUMENT TRANSLATION ERROR]",
            error,
        )

        # -------------------------------------------------
        # DATABASE CLEANUP
        # -------------------------------------------------

        if translated_document_id:

            try:

                (
                    supabase
                    .table(
                        "document_chunks"
                    )
                    .delete()
                    .eq(
                        "document_id",
                        translated_document_id,
                    )
                    .execute()
                )

                (
                    supabase
                    .table(
                        "documents"
                    )
                    .delete()
                    .eq(
                        "id",
                        translated_document_id,
                    )
                    .execute()
                )

            except Exception as cleanup_error:

                print(
                    "[DATABASE CLEANUP ERROR]",
                    cleanup_error,
                )

        # -------------------------------------------------
        # STORAGE CLEANUP
        # -------------------------------------------------

        if (
            storage_uploaded
            and storage_path
        ):

            try:

                (
                    supabase.storage
                    .from_(
                        SUPABASE_STORAGE_BUCKET
                    )
                    .remove(
                        [storage_path]
                    )
                )

            except Exception as storage_error:

                print(
                    "[STORAGE CLEANUP ERROR]",
                    storage_error,
                )

        raise HTTPException(
            status_code=500,
            detail=(
                "Document translation failed: "
                f"{str(error)}"
            ),
        )

    # =====================================================
    # TEMP FILE CLEANUP
    # =====================================================

    finally:

        if input_path.exists():

            try:

                input_path.unlink()

            except Exception as error:

                print(
                    "[INPUT CLEANUP ERROR]",
                    error,
                )

        if output_path.exists():

            try:

                output_path.unlink()

            except Exception as error:

                print(
                    "[OUTPUT CLEANUP ERROR]",
                    error,
                )