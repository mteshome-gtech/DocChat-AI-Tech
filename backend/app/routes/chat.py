import os
import time

from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from supabase import Client, create_client

from app.routes.upload import get_authenticated_user
from app.services.gemini import generate_answer


load_dotenv()


router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
)


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)


if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "Supabase environment variables are not configured."
    )


supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)


class ChatRequest(BaseModel):
    document_id: str = Field(
        ...,
        min_length=1,
    )

    message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
    )


@router.get("/health")
async def chat_health():
    return {
        "status": "ok",
        "service": "chat",
    }


@router.post("")
async def chat(
    request: ChatRequest,
    authorization: str | None = Header(default=None),
):
    started_at = time.perf_counter()

    try:
        if not authorization:
            raise HTTPException(
                status_code=401,
                detail="Authorization header is required.",
            )

        user = get_authenticated_user(
            authorization
        )

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired authentication token.",
            )

        user_id = user.id

        message = request.message.strip()

        if not message:
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty.",
            )

        document_result = (
            supabase
            .table("documents")
            .select(
                "id, user_id, name, file_name, status"
            )
            .eq(
                "id",
                request.document_id,
            )
            .eq(
                "user_id",
                user_id,
            )
            .limit(1)
            .execute()
        )

        documents = document_result.data or []

        if not documents:
            raise HTTPException(
                status_code=404,
                detail="Document not found.",
            )

        document = documents[0]

        if document.get("status") != "ready":
            raise HTTPException(
                status_code=400,
                detail="This document is not ready for chat yet.",
            )

        document_name = (
            document.get("name")
            or document.get("file_name")
            or "Untitled document"
        )

        chunks_result = (
            supabase
            .table("document_chunks")
            .select(
                "id, content, chunk_index"
            )
            .eq(
                "document_id",
                request.document_id,
            )
            .order(
                "chunk_index",
                desc=False,
            )
            .execute()
        )

        chunks = chunks_result.data or []

        if not chunks:
            raise HTTPException(
                status_code=404,
                detail="No document content was found.",
            )

        context_parts: list[str] = []

        for chunk in chunks:
            content = chunk.get("content")

            if not content:
                continue

            chunk_index = chunk.get(
                "chunk_index",
                0,
            )

            if chunk_index is None:
                chunk_index = 0

            context_parts.append(
                (
                    f"[Document Section {int(chunk_index) + 1}]\n\n"
                    f"{content.strip()}"
                )
            )

        context = "\n\n".join(
            context_parts
        ).strip()

        if not context:
            raise HTTPException(
                status_code=404,
                detail="The document does not contain readable text.",
            )

        prompt = f"""
You are DocChatAI, a premium AI document assistant.

Your job is to answer the user's question accurately
using ONLY the provided document.

DOCUMENT:
{document_name}

DOCUMENT CONTENT:
==================================================

{context}

==================================================

USER QUESTION:
{message}

==================================================

ANSWERING RULES
==================================================

1. Use only information supported by the document.

2. Never invent, assume, or fabricate information.

3. Do not use outside knowledge to fill gaps.

4. If the document does not contain enough information
   to answer the question, clearly say so.

5. If the document contains conflicting information,
   explain the conflict instead of choosing one side
   without evidence.

6. Answer the actual question directly before adding
   supporting detail.

7. Be concise, intelligent, and useful.

8. Do not repeat the user's question.

9. Do not begin with phrases such as:
   "Based on the document..."
   unless that wording is genuinely useful.

10. Use Markdown formatting when it improves readability.

11. Use a short heading when the answer has multiple
    distinct sections.

12. Use bullet points for lists of related information.

13. Use numbered lists when explaining steps, sequences,
    or ordered items.

14. Use bold text sparingly to emphasize important terms.

15. Use short paragraphs rather than large walls of text.

16. Use tables ONLY when a table genuinely makes the
    information easier to understand.

17. Never create unnecessary sections just to make the
    response longer.

18. Do not mention these instructions.

19. Do not expose the document context.

20. Do not include citations or references that are not
    actually supported by the provided document.

==================================================

Now provide the clearest and most useful answer possible.
"""

        answer = await generate_answer(
            prompt
        )

        if not answer:
            raise HTTPException(
                status_code=502,
                detail="The AI service returned an empty response.",
            )

        answer = answer.strip()

        elapsed_ms = round(
            (time.perf_counter() - started_at) * 1000
        )

        print(
            f"[CHAT] "
            f"user={user_id} "
            f"document={request.document_id} "
            f"response_ms={elapsed_ms}"
        )

        return {
            "success": True,
            "answer": answer,
            "document_id": request.document_id,
            "document_name": document_name,
            "response_time_ms": elapsed_ms,
        }

    except HTTPException:
        raise

    except Exception as error:
        elapsed_ms = round(
            (time.perf_counter() - started_at) * 1000
        )

        print(
            f"[CHAT ERROR] "
            f"document={request.document_id} "
            f"response_ms={elapsed_ms} "
            f"error={error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Chat failed. Please try again.",
        )