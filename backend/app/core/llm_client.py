import httpx
import json
from typing import Generator
from app.core.database import get_db_direct
from app.models.setting import Setting


def get_llm_config() -> tuple[str, str]:
    """
    Reads LLM base URL and token from the database.
    These are managed via the Settings UI — not from .env.
    """
    db = get_db_direct()
    try:
        rows = db.query(Setting).filter(
            Setting.key.in_(["llm_api_token", "llm_api_base_url"])
        ).all()
        values = {row.key: row.value or "" for row in rows}
        base_url = values.get("llm_api_base_url", "http://10.210.106.4:8080")
        token = values.get("llm_api_token", "")
        return base_url, token
    finally:
        db.close()


def chat_with_llm(messages: list, model: str = None) -> str:
    base_url, token = get_llm_config()

    if not token:
        raise ValueError("LLM API token is not configured. Please go to Settings and enter your API token.")

    request_body = {
        "model": model or "databricks-claude-sonnet-4-6",
        "messages": messages
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            f"{base_url}/api/chat/completions",
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
    base_url, token = get_llm_config()

    if not token:
        raise ValueError("LLM API token is not configured. Please go to Settings and enter your API token.")

    request_body = {
        "model": model or "databricks-claude-sonnet-4-6",
        "messages": messages,
        "stream": True
        }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
        }
    with httpx.Client(timeout=60.0) as client:
        with client.stream(
            "POST",
            f"{base_url}/api/chat/completions",
            json=request_body,
            headers=headers
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0].get("delta", {})
                    text = delta.get("content", "")
                    if text:
                        yield text
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue


def test_llm_connection() -> dict:
    try:
        response = chat_with_llm([
            {"role": "user", "content": "Say hello in one sentence."}
        ])
        return {"status": "ok", "response": response}
    except Exception as e:
        return {"status": "error", "error": str(e)}
