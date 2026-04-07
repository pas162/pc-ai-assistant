import httpx
from typing import Generator
from app.core.config import get_settings

settings = get_settings()


def chat_with_llm(messages: list, model: str = None) -> str:
    """
    Sends messages to the LLM API and returns the response text.
    """
    request_body = {
        "model": model or "databricks-gemini-3-1-flash-lite",
        "messages": messages
    }

    # Authorization header with Bearer token
    headers = {
        "Authorization": f"Bearer {settings.llm_api_token}",
        "Content-Type": "application/json"
    }

    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            f"{settings.llm_api_base_url}/api/chat/completions",
            json=request_body,
            headers=headers
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def stream_chat_with_llm(
    messages: list,
    model: str = None
) -> Generator[str, None, None]:
    """
    Streams the LLM response word by word using Server-Sent Events.

    Instead of waiting for the full response, this yields small text
    chunks as they arrive from the LLM API.

    Yields: text chunks (strings) as they stream in
    """
    request_body = {
        "model": model or "databricks-gemini-3-1-flash-lite",
        "messages": messages,
        "stream": True      # ← this tells the LLM to stream the response
    }

    headers = {
        "Authorization": f"Bearer {settings.llm_api_token}",
        "Content-Type": "application/json"
    }

    # httpx.stream() keeps the connection open and reads chunks as they arrive
    # Unlike client.post() which waits for the complete response
    with httpx.Client(timeout=60.0) as client:
        with client.stream(
            "POST",
            f"{settings.llm_api_base_url}/api/chat/completions",
            json=request_body,
            headers=headers
        ) as response:
            response.raise_for_status()

            # iter_lines() reads the response one line at a time as it streams
            for line in response.iter_lines():

                # Skip empty lines — the LLM sends blank lines between chunks
                if not line:
                    continue

                # Each line starts with "data: " — strip that prefix
                # Example: "data: {"choices":[...]}" → '{"choices":[...]}'
                if not line.startswith("data: "):
                    continue

                data = line[6:]  # remove "data: " (6 characters)

                # "[DONE]" is the LLM's signal that streaming is complete
                if data == "[DONE]":
                    break
                try:
                    import json
                    chunk = json.loads(data)

                    # Extract the text delta from the chunk
                    # delta contains only the NEW piece of text, not the full answer
                    delta = chunk["choices"][0].get("delta", {})
                    text = delta.get("content", "")

                    if text:
                        yield text      # send this piece to the caller

                except (json.JSONDecodeError, KeyError, IndexError):
                    # Malformed chunk — skip it and continue
                    continue


def test_llm_connection() -> dict:
    """
    Sends a simple test message to verify the LLM API is reachable.
    """
    try:
        response = chat_with_llm([
            {"role": "user", "content": "Say hello in one sentence."}
        ])
        return {
            "status": "ok",
            "response": response
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }