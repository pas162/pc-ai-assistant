from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ─── Request schemas ──────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    workspace_id: str
    title: str = "New Chat"


class AttachedFileRequest(BaseModel):
    filename: str
    content: str


class SendMessageRequest(BaseModel):
    content: str
    model: str
    use_rag: bool = True
    attached_files: list[AttachedFileRequest] = []
    mentioned_doc_ids: list[str] = []


class UpdateSessionRequest(BaseModel):
    title: str


# ─── Response schemas ─────────────────────────────────────────────────────────

class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionDetailResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    created_at: datetime
    messages: list[ChatMessageResponse] = []

    model_config = {"from_attributes": True}


class SendMessageResponse(BaseModel):
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    chunks_used: int