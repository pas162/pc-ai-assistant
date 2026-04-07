import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.chat import ChatSession, ChatMessage
from app.schemas.chat import (
    CreateSessionRequest,
    SendMessageRequest,
    SendMessageResponse,
    ChatSessionResponse,
    ChatSessionDetailResponse,
    ChatMessageResponse,
)
from app.core.llm_client import chat_with_llm, stream_chat_with_llm
from app.services.retriever import retrieve_relevant_chunks, build_context

router = APIRouter(prefix="/chat/sessions", tags=["chat-sessions"])


# ─── Endpoint 1: Create a new chat session ─────────────────────────────────────

@router.post("", response_model=ChatSessionResponse)
def create_session(request: CreateSessionRequest, db: Session = Depends(get_db)):
    """
    Create a new chat session inside a workspace.

    Steps:
    1. Validate workspace exists
    2. Create ChatSession row in PostgreSQL
    3. Return the new session
    """
    # Step 1 — Validate workspace exists
    workspace = db.query(Workspace).filter(
        Workspace.id == request.workspace_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Step 2 — Create the session
    session = ChatSession(
        id=str(uuid.uuid4()),
        workspace_id=request.workspace_id,
        title=request.title
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    print(f"Created chat session: {session.id} in workspace: {request.workspace_id}")

    # Step 3 — Return it
    return session


# ─── Endpoint 2: Send a message ────────────────────────────────────────────────

@router.post("/{session_id}/message", response_model=SendMessageResponse)
def send_message(
    session_id: str,
    request: SendMessageRequest,
    db: Session = Depends(get_db)
):
    """
    Send a user message and get an AI response.

    Full RAG + history pipeline:
    1. Validate session exists
    2. Load conversation history from PostgreSQL
    3. Retrieve relevant chunks from ChromaDB
    4. Build messages array: system(chunks) + history + new question
    5. Call LLM
    6. Save user message + assistant message to PostgreSQL
    7. Return both messages
    """
    # Step 1 — Validate session exists
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Step 2 — Load conversation history (ordered oldest → newest)
    # We need chronological order so the LLM sees the conversation correctly
    history = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()

    print(f"Loaded {len(history)} previous messages from session {session_id}")

    # Step 3 — Retrieve relevant chunks from ChromaDB
    # Uses the workspace_id from the session to filter by correct documents
    print(f"Retrieving chunks for: '{request.question}'")
    chunks = retrieve_relevant_chunks(
        question=request.question,
        workspace_id=session.workspace_id
    )
    print(f"  Found {len(chunks)} relevant chunks")

    # Step 4 — Build the messages array for the LLM
    # Structure:
    #   [system message with chunks]
    #   [previous user/assistant messages from history]
    #   [new user question]
    context = build_context(chunks)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful assistant that answers questions "
                "based on the provided document excerpts.\n\n"
                "Use ONLY the information from the excerpts below to answer. "
                "If the answer is not in the excerpts, say so clearly.\n\n"
                f"Document excerpts:\n\n{context}"
            )
        }
    ]

    # Append previous messages from history so LLM has conversation context
    # This is what makes it stateful — without this it would forget everything
    for msg in history:
        messages.append({
            "role": msg.role,       # "user" or "assistant"
            "content": msg.content
        })

    # Append the new user question at the end
    messages.append({
        "role": "user",
        "content": request.question
    })

    # Step 5 — Call the LLM
    print(f"  Calling LLM with {len(messages)} messages (1 system + {len(history)} history + 1 new)...")
    try:
        answer = chat_with_llm(messages)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM call failed: {str(e)}"
        )
    print(f"  Answer received ({len(answer)} characters)")

    # Step 6 — Save both messages to PostgreSQL
    user_message = ChatMessage(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="user",
        content=request.question
    )
    assistant_message = ChatMessage(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="assistant",
        content=answer
    )
    db.add(user_message)
    db.add(assistant_message)
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)

    print(f"  Saved user + assistant messages to session {session_id}")

    # Step 7 — Return both messages
    return SendMessageResponse(
        user_message=ChatMessageResponse.model_validate(user_message),
        assistant_message=ChatMessageResponse.model_validate(assistant_message),
        chunks_used=len(chunks)
    )


# ─── Endpoint 3: List sessions for a workspace ─────────────────────────────────

@router.get("", response_model=list[ChatSessionResponse])
def list_sessions(
    workspace_id: str = Query(..., description="Workspace ID to list sessions for"),
    db: Session = Depends(get_db)
):
    """
    List all chat sessions for a given workspace.

    Usage: GET /chat/sessions?workspace_id=abc-123
    """
    # Validate workspace exists
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Fetch all sessions for this workspace, newest first
    sessions = db.query(ChatSession).filter(
        ChatSession.workspace_id == workspace_id
    ).order_by(ChatSession.created_at.desc()).all()

    print(f"Found {len(sessions)} sessions for workspace {workspace_id}")
    return sessions


# ─── Endpoint 4: Get session with full message history ─────────────────────────

@router.get("/{session_id}", response_model=ChatSessionDetailResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    """
    Get a single chat session with its full message history.

    Usage: GET /chat/sessions/abc-123
    """
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # SQLAlchemy automatically loads messages via the relationship
    # but we want them ordered oldest → newest for display
    session.messages.sort(key=lambda m: m.created_at)

    return session


# ─── Endpoint 5: Stream a message ──────────────────────────────────────────────

@router.post("/{session_id}/stream")
def stream_message(
    session_id: str,
    request: SendMessageRequest,
    db: Session = Depends(get_db)
):
    """
    Stream an AI response word by word using Server-Sent Events (SSE).

    Same RAG + history pipeline as send_message, but:
    - Returns a StreamingResponse instead of JSON
    - Frontend receives text chunks as they arrive
    - Saves messages to DB AFTER streaming completes

    SSE format — each chunk sent to frontend looks like:
        data: {"type": "chunk", "content": "Based"}\n\n
        data: {"type": "chunk", "content": " on"}\n\n
        data: {"type": "done", "content": ""}\n\n
    """
    # Step 1 — Validate session exists
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Step 2 — Load conversation history
    history = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()

    # Step 3 — Retrieve relevant chunks from ChromaDB
    chunks = retrieve_relevant_chunks(
        question=request.question,
        workspace_id=session.workspace_id
    )
    context = build_context(chunks)

    # Step 4 — Build messages array (same as send_message)
    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful assistant that answers questions "
                "based on the provided document excerpts.\n\n"
                "Use ONLY the information from the excerpts below to answer. "
                "If the answer is not in the excerpts, say so clearly.\n\n"
                f"Document excerpts:\n\n{context}"
            )
        }
    ]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.question})

    # Step 5 — Define the generator function that streams + saves to DB
    # This is a nested function so it can access session_id, request, db
    def generate():
        full_answer = ""     # accumulate the complete answer as chunks arrive

        try:
            # Stream chunks from LLM and forward each one to the frontend
            for text_chunk in stream_chat_with_llm(messages):
                full_answer += text_chunk

                # SSE format: "data: {json}\n\n"
                # The double newline \n\n signals end of one SSE event
                payload = json.dumps({"type": "chunk", "content": text_chunk})
                yield f"data: {payload}\n\n"

            # Streaming complete — save both messages to PostgreSQL
            user_msg = ChatMessage(
                id=str(uuid.uuid4()),
                session_id=session_id,
                role="user",
                content=request.question
            )
            assistant_msg = ChatMessage(
                id=str(uuid.uuid4()),
                session_id=session_id,
                role="assistant",
                content=full_answer      # the complete accumulated answer
            )
            db.add(user_msg)
            db.add(assistant_msg)
            db.commit()

            # Send final "done" event with both message IDs
            # Frontend uses these IDs to update its local state
            done_payload = json.dumps({
                "type": "done",
                "user_message_id": user_msg.id,
                "assistant_message_id": assistant_msg.id,
                "chunks_used": len(chunks)
            })
            yield f"data: {done_payload}\n\n"

        except Exception as e:
            # Send error event so frontend knows something went wrong
            error_payload = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_payload}\n\n"

    # Step 6 — Return StreamingResponse
    # media_type "text/event-stream" is the official SSE content type
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            # Disable buffering — we want chunks sent immediately
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
