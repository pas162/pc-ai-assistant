import httpx
from fastapi import APIRouter, HTTPException
from app.core.config import get_settings

settings = get_settings()
router = APIRouter()

@router.get("")
async def get_available_models():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.llm_api_base_url}/api/models",
                headers={"Authorization": f"Bearer {settings.llm_api_token}"},
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

            if isinstance(data, list):
                if all(isinstance(m, str) for m in data):
                    models = data
                else:
                    models = [m.get("id") or m.get("name") or str(m) for m in data]
            elif isinstance(data, dict):
                if "data" in data:
                    models = [m.get("id") or m.get("name") for m in data["data"]]
                elif "models" in data:
                    models = data["models"]
                else:
                    models = []
            else:
                models = []

            models = [m for m in models if m]
            return {"models": models}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="LLM API timed out")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch models")