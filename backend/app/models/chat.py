import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.workspace import Workspace


class ChatSession(Base):
    """
    Represents one conversation in a workspace.
    """
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Belongs to a workspace
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workspaces.id"),
        nullable=False
    )

    # Conversation title (e.g. "Questions about Q3 report")
    title: Mapped[str] = mapped_column(
        String(255),
        default="New Chat"
    )

    # Model used for this session (e.g. "llama-3.1-70b-versatile")
    model: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    # Relationship to workspace
    workspace: Mapped["Workspace"] = relationship("Workspace")

    # Relationship to messages — one session has many messages
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="session"
    )

    def __repr__(self):
        return f"<ChatSession id={self.id} title={self.title}>"


class ChatMessage(Base):
    """
    Represents one message in a chat session.
    Either a user question or an AI answer.
    """
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Belongs to a chat session
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chat_sessions.id"),
        nullable=False
    )

    # Who sent this message: "user" or "assistant"
    role: Mapped[str] = mapped_column(String(50), nullable=False)

    # The actual message text
    content: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    # Relationship back to session
    session: Mapped["ChatSession"] = relationship(
        "ChatSession",
        back_populates="messages"
    )

    def __repr__(self):
        return f"<ChatMessage id={self.id} role={self.role}>"