import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


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

    def __repr__(self):
        return f"<Workspace id={self.id} name={self.name}>"