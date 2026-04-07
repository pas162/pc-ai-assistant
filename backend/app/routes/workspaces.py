import os
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
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    db.delete(workspace)
    db.commit()
    return {"message": "Workspace deleted successfully"}


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

    # Step 5: Run the RAG pipeline — extract, chunk, embed, store
    try:
        file_path = os.path.join(UPLOAD_DIR, f"{document.id}_{document.filename}")

        print(f"Processing '{document.filename}' for workspace {workspace_id}...")

        # 5a. Extract raw text from the file
        text = extract_text(file_path, document.file_type)
        print(f"  Extracted {len(text)} characters")

        # 5b. Split text into overlapping chunks
        chunk_dicts = chunk_document(text, document_id)
        print(f"  Created {len(chunk_dicts)} chunks")

        # Extract just the plain text strings for embedding + ChromaDB
        chunks = [c["text"] for c in chunk_dicts]

        # 5c. Convert all chunks to vectors in one batch (faster than one by one)
        embeddings = get_embeddings_batch(chunks)
        print(f"  Generated {len(embeddings)} embeddings")

        # 5d. Save chunks + vectors into this workspace's ChromaDB collection
        stored = store_document_vectors(
            document_id=document_id,
            workspace_id=workspace_id,
            chunks=chunks,
            embeddings=embeddings
        )

        # 5e. Mark document as completed in PostgreSQL
        document.status = "completed"
        db.commit()

        return {
            "message": f"Successfully attached '{document.filename}' to '{workspace.name}'",
            "chunks_stored": stored
        }

    except Exception as e:
        # If pipeline fails, mark document as failed but keep the DB link
        document.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")


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
