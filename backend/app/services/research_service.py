import os
import time
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.8-flash",
)

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not configured."
    )

client = genai.Client(
    api_key=GEMINI_API_KEY
)


RESEARCH_MODE_INSTRUCTIONS = {
    "deep": """
Conduct broad, rigorous research.

Identify the most important facts, competing viewpoints,
recent developments, evidence, uncertainties, and implications.

Cross-check important claims and prioritize primary,
authoritative, and recent sources.
""",

    "academic": """
Conduct academic-style research.

Prioritize peer-reviewed research, universities,
government publications, reputable research organizations,
and primary sources.

Identify methodology, findings, disagreements,
limitations, and research gaps.
""",

    "business": """
Conduct business intelligence research.

Focus on companies, markets, products, customers,
business models, trends, opportunities, risks,
competitive dynamics, and strategic implications.

Prefer primary company sources, government data,
industry research, and reputable business sources.
""",

    "competitive": """
Conduct competitive intelligence research.

Identify relevant competitors, positioning,
products, pricing where available, target customers,
recent changes, strengths, weaknesses, and differentiation.

Clearly distinguish verified facts from reasonable inference.
""",

    "market": """
Conduct market intelligence research.

Focus on market size where credible data exists,
growth trends, customer behavior, technology changes,
emerging opportunities, threats, and important market signals.

Use recent sources wherever possible.
""",
}


DEPTH_INSTRUCTIONS = {
    "quick": """
Keep the research concise.

Focus on the most important findings and a limited
number of high-quality sources.
""",

    "standard": """
Provide a balanced research report with several
supporting sources and meaningful synthesis.
""",

    "deep": """
Perform comprehensive research.

Cross-check important claims, compare multiple sources,
identify disagreements, explain implications,
and provide a detailed synthesis.
""",
}


def build_research_prompt(
    question: str,
    mode: str,
    depth: str,
    document_context: str,
    use_web: bool,
    use_documents: bool,
) -> str:

    mode_instructions = RESEARCH_MODE_INSTRUCTIONS.get(
        mode,
        RESEARCH_MODE_INSTRUCTIONS["deep"],
    )

    depth_instructions = DEPTH_INSTRUCTIONS.get(
        depth,
        DEPTH_INSTRUCTIONS["deep"],
    )

    if use_web and use_documents:
        source_instructions = """
Use BOTH:

1. The user's private documents.
2. Current public web research.

Clearly distinguish information from the private
documents from information found through web research.
"""

    elif use_web:
        source_instructions = """
Use current public web research.

Prioritize authoritative, recent, and primary sources.
"""

    elif use_documents:
        source_instructions = """
Use ONLY the user's private documents.

Do not introduce unsupported external facts.
"""

    else:
        source_instructions = """
No external research sources are available.
"""

    if document_context:
        private_documents = document_context
    else:
        private_documents = (
            "No private document context was provided."
        )

    return f"""
You are DocChatAI Research Intelligence.

Your task is to investigate the user's question and
produce a rigorous, useful, evidence-backed research report.

RESEARCH QUESTION:

{question}

RESEARCH MODE:

{mode}

{mode_instructions}

RESEARCH DEPTH:

{depth}

{depth_instructions}

SOURCE INSTRUCTIONS:

{source_instructions}

IMPORTANT RULES:

1. Do not fabricate sources.
2. Do not fabricate facts.
3. Clearly distinguish facts from inference.
4. Prefer primary and authoritative sources.
5. Use recent information when the question depends
   on current events or current market conditions.
6. Identify uncertainty where appropriate.
7. Do not blindly agree with the user's premise.
8. Highlight meaningful disagreements between sources.
9. If evidence is insufficient, explicitly say so.
10. Use the supplied private documents as evidence when relevant.
11. Do not claim a private document says something unless
    that information is actually present in the supplied context.
12. When web research is enabled, use Google Search grounding
    to verify current information.

OUTPUT STRUCTURE:

# Executive Summary

Give a concise overview of the answer.

# Key Findings

List the most important findings.

# Evidence

Explain the evidence supporting the findings.

# Analysis

Synthesize the evidence and explain what it means.

# Contradictions & Uncertainty

Identify disagreements, limitations,
or areas where evidence is weak.

# Implications

Explain the practical implications of the research.

# Recommended Next Steps

Provide useful next actions.

Do not create a bibliography with fabricated URLs.

The application will extract grounded web sources
from the Gemini response separately.

PRIVATE DOCUMENT CONTEXT:

{private_documents}
"""


def extract_grounding_data(
    response: Any,
) -> tuple[list[dict], list[str]]:

    sources: list[dict] = []
    queries: list[str] = []

    try:
        candidates = getattr(
            response,
            "candidates",
            None,
        ) or []

        if not candidates:
            return sources, queries

        candidate = candidates[0]

        grounding_metadata = getattr(
            candidate,
            "grounding_metadata",
            None,
        )

        if not grounding_metadata:
            return sources, queries

        web_search_queries = getattr(
            grounding_metadata,
            "web_search_queries",
            None,
        )

        if web_search_queries:
            queries = list(
                web_search_queries
            )

        grounding_chunks = getattr(
            grounding_metadata,
            "grounding_chunks",
            None,
        )

        if not grounding_chunks:
            return sources, queries

        seen_urls: set[str] = set()

        for chunk in grounding_chunks:
            web = getattr(
                chunk,
                "web",
                None,
            )

            if not web:
                continue

            url = getattr(
                web,
                "uri",
                None,
            )

            title = getattr(
                web,
                "title",
                None,
            )

            if not url:
                continue

            if url in seen_urls:
                continue

            seen_urls.add(url)

            sources.append(
                {
                    "title": title or url,
                    "url": url,
                }
            )

    except Exception as error:
        print(
            "Grounding extraction error:",
            error,
        )

    return sources, queries


def generate_research(
    question: str,
    mode: str,
    depth: str,
    document_context: str,
    use_web: bool,
    use_documents: bool,
) -> dict:

    prompt = build_research_prompt(
        question=question,
        mode=mode,
        depth=depth,
        document_context=document_context,
        use_web=use_web,
        use_documents=use_documents,
    )

    tools = []

    if use_web:
        tools.append(
            types.Tool(
                google_search=types.GoogleSearch()
            )
        )

    config = types.GenerateContentConfig(
        tools=tools,
        max_output_tokens=16000,
    )

    response = None
    last_error = None

    for attempt in range(4):
        try:
            print(
                "Research Gemini attempt "
                f"{attempt + 1}/4..."
            )

            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=config,
            )

            break

        except Exception as error:
            last_error = error

            error_text = str(error)

            retryable = (
                "429" in error_text
                or "RESOURCE_EXHAUSTED" in error_text
                or "503" in error_text
                or "UNAVAILABLE" in error_text
                or "500" in error_text
            )

            if (
                not retryable
                or attempt == 3
            ):
                print(
                    "Research Gemini error:",
                    error,
                )

                raise RuntimeError(
                   f"Research Gemini failed: {error}"
                ) from error

            delay = 2 ** attempt

            print(
                "Research service temporarily "
                f"unavailable. Retrying in {delay}s."
            )

            time.sleep(delay)

    if response is None:
        raise RuntimeError(
            f"Research failed: {last_error}"
        )

    answer = getattr(
        response,
        "text",
        None,
    ) or ""

    if not answer.strip():
        raise RuntimeError(
            "Research returned an empty response."
        )

    sources, queries = extract_grounding_data(
        response
    )

    return {
        "answer": answer,
        "sources": sources,
        "queries": queries,
    }