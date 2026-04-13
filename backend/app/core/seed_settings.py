from sqlalchemy.orm import Session
from app.models.setting import Setting

# These are the fallback defaults if nothing is in the DB yet
DEFAULT_SETTINGS = {
    "llm_api_base_url": "http://10.210.106.4:8080",
    "llm_api_token": "",   # empty by default — user must set via UI
}

def seed_default_settings(db: Session) -> None:
    """
    Called once at app startup.
    Inserts default values for any settings that don't exist yet.
    Never overwrites existing values — safe to call every boot.
    """
    for key, value in DEFAULT_SETTINGS.items():
        existing = db.query(Setting).filter(Setting.key == key).first()
        if existing is None:
            db.add(Setting(key=key, value=value))
    db.commit()