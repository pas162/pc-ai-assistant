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
    UpdateSessionRequest,
)
from app.core.llm_client import chat_with_llm, stream_chat_with_llm
from app.services.retriever import retrieve_relevant_chunks, build_context

router = APIRouter(prefix="/chat/sessions", tags=["chat-sessions"])


# ─── Endpoint 1: Create a new chat session ─────────────────────────────────────

@router.post("", response_model=ChatSessionResponse)
def create_session(request: CreateSessionRequest, db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(
        Workspace.id == request.workspace_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    session = ChatSession(
        id=str(uuid.uuid4()),
        workspace_id=request.workspace_id,
        title=request.title
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    print(f"Created chat session: {session.id} in workspace: {request.workspace_id}")
    return session


# ─── Endpoint 2: Send a message ────────────────────────────────────────────────

@router.post("/{session_id}/message", response_model=SendMessageResponse)
def send_message(
    session_id: str,
    request: SendMessageRequest,
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    history = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()

    print(f"Loaded {len(history)} previous messages from session {session_id}")

    chunks = retrieve_relevant_chunks(
        question=request.question,
        workspace_id=session.workspace_id
    )
    print(f"  Found {len(chunks)} relevant chunks")

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
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.question})

    print(f"  Calling LLM with {len(messages)} messages...")
    try:
        answer = chat_with_llm(messages, model=request.model)
    except ValueError as e:
        # Empty token or misconfigured settings — guide user to Settings UI
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {str(e)}")
    print(f"  Answer received ({len(answer)} characters)")

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
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    sessions = db.query(ChatSession).filter(
        ChatSession.workspace_id == workspace_id
    ).order_by(ChatSession.created_at.desc()).all()

    print(f"Found {len(sessions)} sessions for workspace {workspace_id}")
    return sessions


# ─── Endpoint 4: Get session with full message history ─────────────────────────

@router.get("/{session_id}", response_model=ChatSessionDetailResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session.messages.sort(key=lambda m: m.created_at)
    return session


# ─── Endpoint 5: Delete a chat session ────────────────────────────────────────

@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).delete()
    db.delete(session)
    db.commit()

    print(f"Deleted chat session {session_id} and all its messages")
    return None


# ─── Endpoint 6: Stream a message ──────────────────────────────────────────────

@router.post("/{session_id}/stream")
def stream_message(
    session_id: str,
    request: SendMessageRequest,
    db: Session = Depends(get_db)
):
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

    # Step 4 — Build messages array
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

    # Step 5 — Generator function: streams chunks, then saves to DB
    def generate():
        full_answer = ""
        try:
            # ── Stream chunks from LLM ──────────────────────────────────
            try:
                for text_chunk in stream_chat_with_llm(messages, model=request.model):
                    full_answer += text_chunk
                    payload = json.dumps({"type": "chunk", "content": text_chunk})
                    yield f"data: {payload}\n\n"

            except ValueError as e:
                # Empty token or missing base URL — guide user to Settings
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
                return

            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'content': f'LLM request failed: {str(e)}'})}\n\n"
                return

            # ── Save both messages to PostgreSQL ───────────────────────
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
                content=full_answer
            )
            db.add(user_msg)
            db.add(assistant_msg)
            db.commit()

            # ── Auto-title: only on the FIRST message ──────────────────
            new_title = None
            if session.title == "New Chat" and len(history) == 0:
                try:
                    print(f"  Auto-generating title for session {session_id}...")
                    title_messages = [
                        {
                            "role": "user",
                            "content": (
                                f"Create a chat session title for this question: "
                                f'"{request.question}"\n\n'
                                f"Rules:\n"
                                f"- Maximum 5 words\n"
                                f"- No punctuation\n"
                                f"- No quotes\n"
                                f"- Reply with ONLY the title, nothing else\n"
                                f"- Do NOT answer the question\n\n"
                                f"Examples:\n"
                                f"Question: What is the revenue for Q3?\n"
                                f"Title: Q3 Revenue Summary\n\n"
                                f"Question: Can you list the agenda of this doc?\n"
                                f"Title: Document Agenda Overview\n\n"
                                f"Now generate the title:"
                            )
                        }
                    ]
                    generated_title = chat_with_llm(title_messages).strip()
                    if len(generated_title) > 60:
                        generated_title = generated_title[:60].strip()
                    session.title = generated_title
                    db.commit()
                    new_title = generated_title
                    print(f"  Auto-title set to: {new_title}")
                except Exception as e:
                    print(f"  Auto-title failed (non-critical): {e}")

            # ── Send final done event ───────────────────────────────────
            done_payload = json.dumps({
                "type": "done",
                "user_message_id": user_msg.id,
                "assistant_message_id": assistant_msg.id,
                "chunks_used": len(chunks),
                "new_title": new_title,
            })
            yield f"data: {done_payload}\n\n"

        except Exception as e:
            error_payload = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_payload}\n\n"

    # Step 6 — Return StreamingResponse
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


# ─── Endpoint 7: Rename a chat session ────────────────────────────────────────

@router.patch("/{session_id}", response_model=ChatSessionResponse)
def rename_session(
    session_id: str,
    request: UpdateSessionRequest,
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session.title = request.title.strip() or "New Chat"
    db.commit()
    db.refresh(session)

    print(f"Renamed session {session_id} to: {session.title}")
    return session
