from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.schemas.document import DocumentResponse 

class WorkspaceCreate(BaseModel):
    """
    Shape of JSON when CREATING a workspace.
    User sends this in the request body.
    """
    name: str
    description: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    """
    Shape of JSON when UPDATING a workspace.
    All fields are optional — only send what you want to change.
    """
    name: Optional[str] = None
    description: Optional[str] = None

class WorkspaceResponse(BaseModel):
    """
    Shape of JSON when RETURNING a workspace.
    API sends this back to the user.
    """
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    documents: list[DocumentResponse] = []

    class Config:
        from_attributes = True  # allows reading from SQLAlchemy model