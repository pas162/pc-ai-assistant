from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentResponse(BaseModel):
    """
    Shape of JSON when RETURNING a document record.
    API sends this back to the user after upload or when listing documents.
    """
    id: str
    filename: str
    file_type: str | None = None
    file_size: int | None = None
    status: str
    progress: int = 0
    created_at: datetime

    class Config:
        from_attributes = True  # Allows reading from SQLAlchemy model (like Jackson in Java)
    class Config:
        from_attributes = True  # Allows reading from SQLAlchemy model (like Jackson in Java)
