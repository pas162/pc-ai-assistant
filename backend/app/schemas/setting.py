from pydantic import BaseModel
from datetime import datetime


class SettingResponse(BaseModel):
    key: str
    value: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class SettingUpsertRequest(BaseModel):
    value: str