from pydantic import BaseModel
from datetime import datetime


class FolderCreate(BaseModel):
    name: str        # "controllers"
    parent_path: str | None = None  # "java-project/src" or None for root


class FolderResponse(BaseModel):
    id: str
    name: str
    path: str
    created_at: datetime

    class Config:
        from_attributes = True