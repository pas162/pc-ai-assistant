import httpx
from app.core.config import get_settings

settings = get_settings()


def chat_with_llm(messages: list, model: str = None) -> str:
    """
    Sends messages to the LLM API and returns the response text.
    """
    request_body = {
        "model": model or "databricks-claude-haiku-4-5",
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