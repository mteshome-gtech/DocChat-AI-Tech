import os

from dotenv import load_dotenv
from supabase import Client, create_client

from app.services.embeddings import generate_query_embedding

load_dotenv()


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


async def retrieve_relevant_chunks(
    question: str,
    document_id: str,
    user_id: str,
    match_count: int = 8,
    match_threshold: float = 0.35,
) -> list[dict]:
    """
    Retrieve the most relevant document chunks for a question
    using pgvector cosine similarity.
    """

    if not question or not question.strip():
        raise ValueError(
            "Question cannot be empty."
        )

    if not document_id:
        raise ValueError(
            "Document ID is required."
        )

    if not user_id:
        raise ValueError(
            "User ID is required."
        )

    if match_count < 1:
        raise ValueError(
            "match_count must be at least 1."
        )

    if not 0 <= match_threshold <= 1:
        raise ValueError(
            "match_threshold must be between 0 and 1."
        )

    # Generate the embedding for the user's question.
    question_embedding = await generate_query_embedding(
        question
    )

    # Call the PostgreSQL pgvector RPC function.
    result = supabase.rpc(
        "match_document_chunks",
        {
            "query_embedding": question_embedding,
            "match_document_id": document_id,
            "match_user_id": user_id,
        "match_count": match_count,
            "match_threshold": match_threshold,
        },
    ).execute()

    chunks = result.data or []

    return chunks