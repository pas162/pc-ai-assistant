from pydantic import BaseModel
from datetime import datetime


# ─── Request Bodies ────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    """
    Body for creating a new chat session.
    """
    workspace_id: str
    title: str = "New Chat"  # optional — defaults to "New Chat"


class SendMessageRequest(BaseModel):
    """
    Body for sending a message in an existing session.
    """
    question: str


# ─── Response Bodies ───────────────────────────────────────────────────────────

class ChatMessageResponse(BaseModel):
    """
    Represents one message returned in API responses.
    """
    id: str
    role: str           # "user" or "assistant"
    content: str
    created_at: datetime

    class Config:
        from_attributes = True  # allows building from SQLAlchemy model directly


class ChatSessionResponse(BaseModel):
    """
    Represents a session (without messages) — used in list view.
    """
    id: str
    workspace_id: str
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionDetailResponse(BaseModel):
    """
    Represents a session WITH its full message history.
    Used when fetching a single session.
    """
    id: str
    workspace_id: str
    title: str
    created_at: datetime
    messages: list[ChatMessageResponse]  # full history included

    class Config:
        from_attributes = True


class SendMessageResponse(BaseModel):
    """
    Returned after sending a message.
    Contains both the saved user message and the AI answer.
    """
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    chunks_used: int