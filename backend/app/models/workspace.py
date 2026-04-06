import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Table, Column, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

workspace_document_table = Table(
    "workspace_documents",
    Base.metadata,
    Column("workspace_id", String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", String(36), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
)

class Workspace(Base):
    """
    Represents a workspace (project folder).
    """
    __tablename__ = "workspaces"  # the actual table name in PostgreSQL

    # Primary key — UUID instead of auto-increment integer
    # UUID is better for distributed systems (no conflicts)
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Workspace name — required
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Optional description
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Timestamps — set automatically
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

        # A workspace can have many documents
    documents: Mapped[list["Document"]] = relationship(
        "Document",
        secondary=workspace_document_table,
        back_populates="workspaces"
    )

    def __repr__(self):
        return f"<Workspace id={self.id} name={self.name}>"