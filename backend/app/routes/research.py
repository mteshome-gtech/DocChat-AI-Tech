from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from supabase import create_client, Client

from app.routes.upload import get_authenticated_user
from app.services.research_service import (
    generate_research,
)

load_dotenv()

router = APIRouter(
    prefix="/research",
    tags=["Research"],
)

SUPABASE_URL = __import__(
    "os"
).getenv("SUPABASE_URL")

SUPABASE_SERVICE_ROLE_KEY = __import__(
    "os"
).getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)

if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL is not configured."
    )

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)


class ResearchRequest(BaseModel):
    question: str = Field(
        min_length=3,
        max_length=10000,
    )

    mode: str = "deep"

    depth: str = "deep"

    use_web: bool = True

    use_documents: bool = True

    document_ids: list[str] = Field(
        default_factory=list
    )


VALID_MODES = {
    "deep",
    "academic",
    "business",
    "competitive",
    "market",
}

VALID_DEPTHS = {
    "quick",
    "standard",
    "deep",
}


def load_document_context(
    user_id: str,
    document_ids: list[str],
) -> tuple[str, int]:

    if not document_ids:
        return "", 0

    documents_result = (
        supabase
        .table("documents")
        .select(
            "id, name, file_name"
        )
        .eq(
            "user_id",
            user_id,
        )
        .in_(
            "id",
            document_ids,
        )
        .execute()
    )

    documents = (
        documents_result.data or []
    )

    if not documents:
        return "", 0

    valid_document_ids = [
        str(document["id"])
        for document in documents
    ]

    chunks_result = (
        supabase
        .table("document_chunks")
        .select(
            "document_id, chunk_index, content"
        )
        .in_(
            "document_id",
            valid_document_ids,
        )
        .order(
            "chunk_index",
            desc=False,
        )
        .execute()
    )

    chunks = chunks_result.data or []

    grouped: dict[
        str,
        list[str]
    ] = {}

    for chunk in chunks:
        document_id = str(
            chunk["document_id"]
        )

        content = (
            chunk.get("content")
            or ""
        )

        if not content:
            continue

        grouped.setdefault(
            document_id,
            [],
        ).append(content)

    sections: list[str] = []

    for document in documents:
        document_id = str(
            document["id"]
        )

        document_name = (
            document.get("name")
            or document.get("file_name")
            or "Untitled document"
        )

        content = "\n\n".join(
            grouped.get(
                document_id,
                [],
            )
        )

        if not content:
            continue

        sections.append(
            "\n".join(
                [
                    "DOCUMENT",
                    f"Name: {document_name}",
                    "",
                    "CONTENT:",
                    content,
                ]
            )
        )

    return (
        "\n\n".join(sections),
        len(documents),
    )


@router.post("")
async def research(
    request: ResearchRequest,
    authorization: str | None = Header(
        default=None
    ),
):
    user = get_authenticated_user(
        authorization
    )

    if request.mode not in VALID_MODES:
        raise HTTPException(
            status_code=400,
            detail="Invalid research mode.",
        )

    if request.depth not in VALID_DEPTHS:
        raise HTTPException(
            status_code=400,
            detail="Invalid research depth.",
        )

    if (
        not request.use_web
        and not request.use_documents
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "At least one research source "
                "must be enabled."
            ),
        )

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

    profile = (
        profile_result.data or {}
    )

    plan = profile.get(
        "plan",
        "free",
    )

    if plan not in {
        "pro",
    }:
        raise HTTPException(
            status_code=403,
            detail=(
                "Advanced Research requires "
                "the Business plan."
            ),
        )

    document_context = ""

    document_count = 0

    if request.use_documents:

        (
            document_context,
            document_count,
        ) = load_document_context(
            user_id=str(user.id),
            document_ids=request.document_ids,
        )

    if (
        request.use_documents
        and not request.use_web
        and not document_context
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "No readable document content "
                "was found in the selected documents."
            ),
        )

    try:
        result = generate_research(
            question=request.question.strip(),
            mode=request.mode,
            depth=request.depth,
            document_context=document_context,
            use_web=request.use_web,
            use_documents=request.use_documents,
        )

    except RuntimeError as error:
        print(
            "Research service error:",
            error,
        )

        raise HTTPException(
            status_code=502,
            detail=str(error),
        ) from error

    except Exception as error:
        print(
            "Unexpected research error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "An unexpected research error occurred."
            ),
        ) from error

    return {
        "success": True,
        "answer": result["answer"],
        "sources": result["sources"],
        "queries": result["queries"],
        "mode": request.mode,
        "depth": request.depth,
        "document_count": document_count,
    }