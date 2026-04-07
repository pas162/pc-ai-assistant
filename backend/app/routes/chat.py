from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.workspace import Workspace
from app.core.llm_client import chat_with_llm
from app.services.retriever import retrieve_relevant_chunks, build_context

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """
    The request body for a chat message.
    """
    question: str
    workspace_id: str


class ChatResponse(BaseModel):
    """
    The response body for a chat message.
    """
    answer: str
    chunks_used: int
    workspace_name: str


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    Ask a question about documents in a workspace.

    Full RAG pipeline:
    1. Validate workspace exists
    2. Retrieve relevant chunks from ChromaDB
    3. Build context from chunks
    4. Send context + question to LLM
    5. Return answer
    """
    # Step 1: Validate workspace exists
    workspace = db.query(Workspace).filter(
        Workspace.id == request.workspace_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Step 2: Retrieve relevant chunks from ChromaDB
    print(f"Retrieving chunks for question: '{request.question}'")
    chunks = retrieve_relevant_chunks(
        question=request.question,
        workspace_id=request.workspace_id
    )
    print(f"  Found {len(chunks)} relevant chunks")

    # Step 3: Build context string from chunks
    context = build_context(chunks)

    # Step 4: Build messages for LLM
    # System message tells the LLM its role and gives it the context
    # User message is the actual question
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
        },
        {
            "role": "user",
            "content": request.question
        }
    ]

    # Step 5: Call the LLM
    print(f"  Calling LLM...")
    try:
        answer = chat_with_llm(messages)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM call failed: {str(e)}"
        )

    print(f"  Answer received ({len(answer)} characters)")

    return ChatResponse(
        answer=answer,
        chunks_used=len(chunks),
        workspace_name=workspace.name
    )