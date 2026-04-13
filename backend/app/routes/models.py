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
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{base_url}/api/models",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            response.raise_for_status()
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
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="LLM API timed out")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch models")