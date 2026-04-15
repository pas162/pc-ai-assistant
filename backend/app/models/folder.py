import uuid
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Folder(Base):
    """
    Represents a virtual folder in the Knowledge Base.
    Folders are write-once — no rename, no move.

    Path is the source of truth for tree structure.
    Example paths:
        "java-project"
        "java-project/src"
        "java-project/src/controllers"
    """
    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Display name — the last segment of the path
    # e.g. path="java-project/src/controllers" → name="controllers"
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Full path from root — unique, write-once, never updated
    # This is what documents.folder_path matches against
    path: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    def __repr__(self):
        return f"<Folder id={self.id} path={self.path}>"
