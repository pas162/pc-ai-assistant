import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.chat import ChatSession, ChatMessage
from app.models.document import Document
from app.schemas.chat import (
    CreateSessionRequest,
    SendMessageRequest,
    UpdateSessionRequest,
    ChatSessionResponse,
    ChatSessionDetailResponse,
    ChatMessageResponse,
    SendMessageResponse,
)
from app.core.llm_client import chat_with_llm, stream_chat_with_llm
from app.services.retriever import retrieve_relevant_chunks, build_context

router = APIRouter(prefix="/chat/sessions", tags=["chat-sessions"])

FORMATTING_RULES = (
    "You MUST format ALL responses using strict Markdown syntax. This is mandatory:\n"
    "- ALL lists MUST use '- ' prefix on every line (e.g., '- item one')\n"
    "- NEVER write a list as plain text lines without '- ' prefix\n"
    "- Use ## or ### for section headings\n"
    "- Use **bold** for important terms\n"
    "- Always wrap code in fenced code blocks with language tag (e.g., ```python)\n"
    "- Never write code as plain text outside of a code block\n"
    "- Format tables with each row on a new line using | Col1 | Col2 | syntax\n"
    "- Never put an entire table on a single line\n"
)


# ─── Endpoint 1: Create a new chat session ────────────────────────────────────


@router.post("", response_model=ChatSessionResponse)
def create_session(request: CreateSessionRequest, db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == request.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    session = ChatSession(
        id=str(uuid.uuid4()),
        workspace_id=request.workspace_id,
        title=request.title,
        model=request.model,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    print(f"Created chat session: {session.id} in workspace: {request.workspace_id}")
    return session


# ─── Endpoint 2: List sessions for a workspace ────────────────────────────────


@router.get("", response_model=list[ChatSessionResponse])
def list_sessions(
    workspace_id: str = Query(..., description="Workspace ID to list sessions for"),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.workspace_id == workspace_id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )

    print(f"Found {len(sessions)} sessions for workspace {workspace_id}")
    return sessions


# ─── Endpoint 3: Get session with full message history ────────────────────────


@router.get("/{session_id}", response_model=ChatSessionDetailResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session.messages.sort(key=lambda m: m.created_at)
    return session


# ─── Endpoint 4: Delete a chat session ───────────────────────────────────────


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.delete(session)
    db.commit()

    print(f"Deleted chat session {session_id} and all its messages")
    return None


# ─── Endpoint 5: Rename a chat session ───────────────────────────────────────


@router.patch("/{session_id}", response_model=ChatSessionResponse)
def rename_session(
    session_id: str, request: UpdateSessionRequest, db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session.title = request.title.strip() or "New Chat"
    db.commit()
    db.refresh(session)

    print(f"Renamed session {session_id} to: {session.title}")
    return session


# ─── Endpoint 6: Send a message (non-streaming) ───────────────────────────────


@router.post("/{session_id}/message", response_model=SendMessageResponse)
def send_message(
    session_id: str, request: SendMessageRequest, db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    print(f"Loaded {len(history)} previous messages from session {session_id}")

    if request.use_rag:
        chunks = retrieve_relevant_chunks(
            question=request.content,
            workspace_id=session.workspace_id,
        )
        context = build_context(chunks)
        print(f"  RAG enabled — found {len(chunks)} relevant chunks")
    else:
        chunks = []
        context = None
        print("  RAG disabled — skipping document retrieval")

    if request.use_rag:
        system_content = (
            f"{FORMATTING_RULES}\n\n"
            "You are a helpful technical assistant. "
            "Answer questions using the provided document excerpts as your primary source.\n\n"
            "Guidelines:\n"
            "- Answer as completely and specifically as possible\n"
            "- If the excerpts contain partial information, use it and clearly indicate what is covered\n"
            "- Synthesize information across multiple excerpts when relevant\n"
            "- Only say information is unavailable if it is truly absent from ALL excerpts\n\n"
            f"Document excerpts:\n\n{context}"
        )
    else:
        system_content = (
            f"{FORMATTING_RULES}\n\n"
            "You are a helpful technical assistant. "
            "Answer questions using your own knowledge.\n\n"
        )

    messages = [{"role": "system", "content": system_content}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.content})

    print(f"  Calling LLM with {len(messages)} messages...")
    try:
        answer = chat_with_llm(messages, model=request.model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {str(e)}")
    print(f"  Answer received ({len(answer)} characters)")

    user_message = ChatMessage(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="user",
        content=request.content,
    )
    assistant_message = ChatMessage(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="assistant",
        content=answer,
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
        chunks_used=len(chunks),
    )


# ─── Endpoint 7: Stream a message ────────────────────────────────────────────


@router.post("/{session_id}/stream")
def stream_message(
    session_id: str, request: SendMessageRequest, db: Session = Depends(get_db)
):
    # Step 1 — Validate session
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Step 2 — Load conversation history
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    # Step 3 — RAG retrieval
    chunks = []
    context = None
    sources = []

    if request.use_rag:
        chunks = retrieve_relevant_chunks(
            question=request.content,
            workspace_id=session.workspace_id,
        )
        context = build_context(chunks)
        print(f"  RAG enabled — found {len(chunks)} relevant chunks")

        seen_ids = set()
        unique_doc_ids = []
        for chunk in chunks:
            doc_id = chunk["document_id"]
            if doc_id and doc_id not in seen_ids:
                seen_ids.add(doc_id)
                unique_doc_ids.append(doc_id)

        # Include mentioned doc ids in sources too
        for doc_id in request.mentioned_doc_ids:
            if doc_id not in seen_ids:
                seen_ids.add(doc_id)
                unique_doc_ids.append(doc_id)

        source_docs = db.query(Document).filter(Document.id.in_(unique_doc_ids)).all()
        sources = [{"id": doc.id, "filename": doc.filename} for doc in source_docs]
    else:
        print("  RAG disabled — skipping document retrieval")

    # Step 4 — Build mentioned docs context
    mentioned_context = ""
    if request.mentioned_doc_ids:
        mentioned_docs = (
            db.query(Document).filter(Document.id.in_(request.mentioned_doc_ids)).all()
        )
        print(f"  Mentioned docs: {[d.filename for d in mentioned_docs]}")

        for doc in mentioned_docs:
            doc_chunks = retrieve_relevant_chunks(
                question=request.content,
                workspace_id=session.workspace_id,
                filter_doc_id=doc.id,
            )
            if doc_chunks:
                mentioned_context += f"\n\n--- From: {doc.filename} ---\n"
                mentioned_context += build_context(doc_chunks)
            else:
                print(f"  No chunks found for mentioned doc: {doc.filename}")

        if not request.use_rag:
            sources = [{"id": doc.id, "filename": doc.filename} for doc in mentioned_docs]

    # Step 5 — Build attached files context
    attached_context = ""
    if request.attached_files:
        for f in request.attached_files:
            attached_context += f"\n\n--- Attached file: {f.filename} ---\n{f.content}"
        print(f"  Attached files: {[f.filename for f in request.attached_files]}")

    # Step 6 — Build system prompt
    has_context = context or mentioned_context or attached_context

    if has_context:
        full_context = ""
        if context:
            full_context += f"Document excerpts:\n\n{context}"
        if mentioned_context:
            full_context += f"\n\nMentioned documents:\n{mentioned_context}"
        if attached_context:
            full_context += f"\n\nAttached files:\n{attached_context}"

        system_content = (
            f"{FORMATTING_RULES}\n\n"
            "You are a helpful technical assistant. "
            "Answer questions using the provided document excerpts as your primary source.\n\n"
            "Guidelines:\n"
            "- Answer as completely and specifically as possible\n"
            "- If the excerpts contain partial information, use it and clearly indicate what is covered\n"
            "- Synthesize information across multiple excerpts when relevant\n"
            "- Only say information is unavailable if it is truly absent from ALL excerpts\n\n"
            f"{full_context}"
        )
    else:
        system_content = (
            f"{FORMATTING_RULES}\n\n"
            "You are a helpful technical assistant. "
            "Answer questions using your own knowledge."
        )

    messages = [{"role": "system", "content": system_content}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.content})

    # Step 7 — Stream generator
    def generate():
        full_answer = ""
        try:
            # ── Stream chunks from LLM ────────────────────────────────
            try:
                for text_chunk in stream_chat_with_llm(messages, model=request.model):
                    full_answer += text_chunk
                    payload = json.dumps({"type": "chunk", "content": text_chunk})
                    yield f"data: {payload}\n\n"

            except ValueError as e:
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
                return

            except Exception as e:
                yield (
                    f"data: {json.dumps({'type': 'error', 'content': f'LLM request failed: {str(e)}'})}\n\n"
                )
                return

            # ── Save messages to DB ───────────────────────────────────
            user_msg = ChatMessage(
                id=str(uuid.uuid4()),
                session_id=session_id,
                role="user",
                content=request.content,
            )
            assistant_msg = ChatMessage(
                id=str(uuid.uuid4()),
                session_id=session_id,
                role="assistant",
                content=full_answer,
            )
            db.add(user_msg)
            db.add(assistant_msg)
            
            # ── Save model used for this session ──────────────────────
            if request.model:
                session.model = request.model
            
            db.commit()

            # ── Auto-title on first message ───────────────────────────
            new_title = None
            if session.title == "New Chat" and len(history) == 0:
                try:
                    print(f"  Auto-generating title for session {session_id}...")
                    title_messages = [
                        {
                            "role": "user",
                            "content": (
                                f'Create a chat session title for this question: "{request.content}"\n\n'
                                "Rules:\n"
                                "- Maximum 5 words\n"
                                "- No punctuation\n"
                                "- No quotes\n"
                                "- Reply with ONLY the title, nothing else\n"
                                "- Do NOT answer the question\n\n"
                                "Examples:\n"
                                "Question: What is the revenue for Q3?\n"
                                "Title: Q3 Revenue Summary\n\n"
                                "Question: Can you list the agenda of this doc?\n"
                                "Title: Document Agenda Overview\n\n"
                                "Now generate the title:"
                            ),
                        }
                    ]
                    generated_title = chat_with_llm(title_messages, model=request.model).strip()
                    if len(generated_title) > 60:
                        generated_title = generated_title[:60].strip()
                    session.title = generated_title
                    db.commit()
                    new_title = generated_title
                except Exception:
                    pass  # Auto-title is non-critical

            # ── Send done event ───────────────────────────────────────
            done_payload = json.dumps(
                {
                    "type": "done",
                    "user_message_id": user_msg.id,
                    "assistant_message_id": assistant_msg.id,
                    "chunks_used": len(chunks),
                    "sources": sources,
                    "new_title": new_title,
                }
            )
            yield f"data: {done_payload}\n\n"

        except Exception as e:
            error_payload = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_payload}\n\n"

    # Step 8 — Return StreamingResponse
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
