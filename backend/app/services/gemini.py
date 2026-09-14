import os
import asyncio

from dotenv import load_dotenv
from google import genai
from google.genai import types


load_dotenv()


GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY"
)

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


async def generate_answer(
    prompt: str,
) -> str:

    if not prompt.strip():
        raise ValueError(
            "Prompt cannot be empty."
        )

    max_attempts = 4

    for attempt in range(max_attempts):
        try:
            response = await client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=4096,
                ),
            )

            answer = (
                response.text
                if response
                else None
            )

            if not answer:
                raise RuntimeError(
                    "Gemini returned an empty response."
                )

            return answer.strip()

        except Exception as error:

            error_text = str(error).upper()

            transient_error = any(
                code in error_text
                for code in [
                    "429",
                    "503",
                    "UNAVAILABLE",
                    "RESOURCE_EXHAUSTED",
                    "INTERNAL",
                ]
            )

            if (
                transient_error
                and attempt < max_attempts - 1
            ):
                wait_time = 2 ** attempt

                print(
                    f"[GEMINI] Temporary error. "
                    f"Retrying in {wait_time}s..."
                )

                await asyncio.sleep(
                    wait_time
                )

                continue

            print(
                f"[GEMINI ERROR] {error}"
            )

            raise