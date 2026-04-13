from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.setting import Setting
from app.schemas.setting import SettingResponse, SettingUpsertRequest

router = APIRouter()

# Defines which keys are allowed — prevents arbitrary data being stored
ALLOWED_KEYS = {"llm_api_token", "llm_api_base_url"}


@router.get("", response_model=list[SettingResponse])
def get_all_settings(db: Session = Depends(get_db)):
    """
    Returns all settings rows.
    NOTE: token value is returned here — only use on internal network.
    """
    return db.query(Setting).all()


@router.put("/{key}", response_model=SettingResponse)
def upsert_setting(
    key: str,
    body: SettingUpsertRequest,
    db: Session = Depends(get_db),
):
    """
    Insert or update a setting by key.
    Like a Java Map.put() — creates if missing, overwrites if exists.
    """
    if key not in ALLOWED_KEYS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown setting key: {key}")

    setting = db.query(Setting).filter(Setting.key == key).first()

    if setting is None:
        setting = Setting(key=key, value=body.value)
        db.add(setting)
    else:
        setting.value = body.value

    db.commit()
    db.refresh(setting)
    return setting