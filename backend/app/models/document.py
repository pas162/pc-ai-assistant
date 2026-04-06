import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.workspace import Workspace


class Document(Base):
    """
    Represents an uploaded document in a workspace.
    """
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Original file name (e.g. "report.pdf")
    filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # File type (e.g. "pdf", "txt", "docx")
    file_type: Mapped[str] = mapped_column(String(50), nullable=True)

    # File size in bytes
    file_size: Mapped[int] = mapped_column(Integer, nullable=True)

    # Processing status: "pending", "processing", "completed", "failed"
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    # A document can be linked to many workspaces
    workspaces: Mapped[list["Workspace"]] = relationship(
        "Workspace",
        secondary="workspace_documents",
        back_populates="documents"
    )

    def __repr__(self):
        return f"<Document id={self.id} filename={self.filename}>"