import os
import pickle
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.document import Document
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate
from app.services.text_extractor import extract_text
from app.services.text_chunker import chunk_document
from app.services.embedder import get_embeddings_batch
from app.services.vector_store import store_document_vectors, delete_document_vectors

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

UPLOAD_DIR = "uploaded_docs"


@router.post("", response_model=WorkspaceResponse)
def create_workspace(workspace: WorkspaceCreate, db: Session = Depends(get_db)):
    """
    Create a new workspace.
    """
    db_workspace = Workspace(
        name=workspace.name,
        description=workspace.description
    )
    db.add(db_workspace)
    db.commit()
    db.refresh(db_workspace)
    return db_workspace


@router.get("", response_model=List[WorkspaceResponse])
def list_workspaces(db: Session = Depends(get_db)):
    """
    Get all workspaces.
    """
    return db.query(Workspace).all()


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    """
    Get one workspace by id.
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(workspace_id: str, workspace: WorkspaceUpdate, db: Session = Depends(get_db)):
    """
    Update a workspace name and/or description.
    Only fields provided in the request body will be changed.
    """
    db_workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if db_workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if workspace.name is not None:
        db_workspace.name = workspace.name
    if workspace.description is not None:
        db_workspace.description = workspace.description
    db.commit()
    db.refresh(db_workspace)
    return db_workspace


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: str, db: Session = Depends(get_db)):
    """
    Delete a workspace by id.
    Also deletes all associated chat sessions and their messages.
    """
    from app.models.chat import ChatSession, ChatMessage  # Import here to avoid circular imports
    
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Step 1: Find all chat sessions in this workspace
    sessions = db.query(ChatSession).filter(
        ChatSession.workspace_id == workspace_id
    ).all()
    
    # Step 2: Delete all messages in those sessions first (child records)
    for session in sessions:
        db.query(ChatMessage).filter(
            ChatMessage.session_id == session.id
        ).delete()
    
    # Step 3: Delete all chat sessions in this workspace
    db.query(ChatSession).filter(
        ChatSession.workspace_id == workspace_id
    ).delete()
    
    # Step 4: Now delete the workspace itself
    db.delete(workspace)
    db.commit()
    
    return {"message": "Workspace and all associated chat sessions deleted successfully"}


@router.post("/{workspace_id}/documents/bulk")
def bulk_link_documents_to_workspace(
    workspace_id: str,
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Attach multiple documents to a workspace in one request.
    Skips already-attached docs and not-ready docs silently.
    Returns a summary of what was attached vs skipped.
    """
    document_ids: list = body.get("document_ids", [])

    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    attached = []
    skipped  = []
    failed   = []

    for document_id in document_ids:
        document = db.query(Document).filter(Document.id == document_id).first()

        # Skip missing or already attached
        if not document:
            skipped.append(document_id)
            continue
        if document in workspace.documents:
            skipped.append(document_id)
            continue
        if document.status != "completed":
            skipped.append(document_id)
            continue

        # Link in DB
        workspace.documents.append(document)
        db.commit()

        # Load cache → store vectors
        try:
            cache_path = os.path.join(UPLOAD_DIR, f"{document.id}_cache.pkl")
            if not os.path.exists(cache_path):
                raise ValueError("Cache file not found")

            with open(cache_path, "rb") as f:
                cached_data = pickle.load(f)

            store_document_vectors(
                document_id=document_id,
                workspace_id=workspace_id,
                chunks=cached_data["chunks"],
                embeddings=cached_data["embeddings"]
            )
            attached.append(document.filename)

        except Exception as e:
            print(f"[BulkAttach] Failed for {document_id}: {e}")
            workspace.documents.remove(document)
            db.commit()
            failed.append(document_id)

    return {
        "attached": attached,
        "skipped":  len(skipped),
        "failed":   len(failed)
    }

@router.post("/{workspace_id}/documents/{document_id}")
def link_document_to_workspace(
    workspace_id: str,
    document_id: str,
    db: Session = Depends(get_db)
):
    """
    Attach an existing document from the Knowledge Base to a Workspace.
    Also runs the full RAG pipeline: extract → chunk → embed → store vectors.
    """
    # Step 1: Find the Workspace
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Step 2: Find the Document
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Step 3: Check if it's already linked (prevent duplicates)
    if document in workspace.documents:
        return {"message": "Document is already attached to this workspace"}

    # Step 4: Create the DB link
    workspace.documents.append(document)
    db.commit()

    # Step 5: Load from cache and store in ChromaDB
    try:
        cache_path = os.path.join(UPLOAD_DIR, f"{document.id}_cache.pkl")
        
        print(f"[Attach] Looking for cache file: {cache_path}")
        
        if not os.path.exists(cache_path):
            raise ValueError(f"Cache file not found at {cache_path}. Document may still be processing.")

        print(f"[Attach] Loading cache file...")
        with open(cache_path, "rb") as f:
            cached_data = pickle.load(f)

        print(f"[Attach] Cache loaded. Chunks: {len(cached_data['chunks'])}, Embeddings: {len(cached_data['embeddings'])}")
        
        stored = store_document_vectors(
            document_id=document_id,
            workspace_id=workspace_id,
            chunks=cached_data["chunks"],
            embeddings=cached_data["embeddings"]
        )
        print(f"[Attach] Stored {stored} vectors in ChromaDB")

        return {
            "message": f"Successfully attached '{document.filename}' to '{workspace.name}'",
            "chunks_stored": stored
        }

    except Exception as e:
        import traceback
        print(f"[Attach] FULL ERROR:\n{traceback.format_exc()}")  # ← prints full stack trace
        workspace.documents.remove(document)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Attach failed: {str(e)}")


@router.delete("/{workspace_id}/documents/{document_id}")
def unlink_document_from_workspace(
    workspace_id: str,
    document_id: str,
    db: Session = Depends(get_db)
):
    """
    Remove a document from a Workspace (but keep it in the Knowledge Base).
    Also deletes this document's vectors from this workspace's ChromaDB collection.
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document not in workspace.documents:
        raise HTTPException(status_code=400, detail="Document is not attached to this workspace")

    # Remove the DB link
    workspace.documents.remove(document)
    db.commit()

    # Remove vectors from this workspace's ChromaDB collection only
    try:
        delete_document_vectors(
            document_id=document_id,
            workspace_id=workspace_id
        )
    except Exception as e:
        print(f"  Warning: Could not delete vectors: {str(e)}")

    return {"message": f"Successfully removed '{document.filename}' from '{workspace.name}'"}

