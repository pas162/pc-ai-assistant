import httpx
from fastapi import APIRouter, HTTPException
from app.core.database import get_db_direct
from app.models.setting import Setting

router = APIRouter()

def get_llm_config():
    db = get_db_direct()
    try:
        rows = db.query(Setting).filter(
            Setting.key.in_(["llm_api_token", "llm_api_base_url"])
        ).all()
        values = {row.key: row.value or "" for row in rows}
        return (
            values.get("llm_api_base_url", "http://10.210.106.4:8080"),
            values.get("llm_api_token", ""),
        )
    finally:
        db.close()


@router.get("")
async def get_available_models():
    base_url, token = get_llm_config()
    
    # Try multiple endpoint paths for different providers
    # Order: /models (OpenAI/Groq), /api/models (internal), /v1/models
    paths_to_try = ["/models", "/api/models", "/v1/models"]
    
    async with httpx.AsyncClient() as client:
        for path in paths_to_try:
            try:
                response = await client.get(
                    f"{base_url}{path}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()

                    if isinstance(data, list):
                        models = data if all(isinstance(m, str) for m in data) else [m.get("id") or m.get("name") or str(m) for m in data]
                    elif isinstance(data, dict):
                        if "data" in data:
                            models = [m.get("id") or m.get("name") for m in data["data"]]
                        elif "models" in data:
                            models = data["models"]
                        else:
                            models = []
                    else:
                        models = []

                    return {"models": [m for m in models if m]}
            except httpx.HTTPStatusError:
                continue  # Try next path
            except Exception:
                continue  # Try next path
    
    # If all paths failed, return hardcoded Groq models as fallback
    # This ensures the UI works even if the models endpoint fails
    groq_models = [
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "llama3-groq-70b-8192-tool-use-preview",
        "llama3-groq-8b-8192-tool-use-preview"
    ]
    
    return {"models": groq_models, "fallback": True}