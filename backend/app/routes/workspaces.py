from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.document import Document
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceResponse)
def create_workspace(workspace: WorkspaceCreate, db: Session = Depends(get_db)):
    """
    Create a new workspace.
    """
    # Create a new Workspace object from the request data
    db_workspace = Workspace(
        name=workspace.name,
        description=workspace.description
    )
    db.add(db_workspace)
    db.commit()                # save to database
    db.refresh(db_workspace)   # reload from database (gets generated id)
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
    # Step 1 — find the workspace
    db_workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if db_workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Step 2 — only update fields that were actually sent
    if workspace.name is not None:
        db_workspace.name = workspace.name
    if workspace.description is not None:
        db_workspace.description = workspace.description

    # Step 3 — save
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

    # Step 4: Create the link!
    # Because we set up the SQLAlchemy relationship, this is incredibly easy.
    # We just append the document to the workspace's list of documents.
    workspace.documents.append(document)
    
    db.commit()
    
    return {"message": f"Successfully attached '{document.filename}' to '{workspace.name}'"}

@router.delete("/{workspace_id}/documents/{document_id}")
def unlink_document_from_workspace(
    workspace_id: str, 
    document_id: str, 
    db: Session = Depends(get_db)
):
    """
    Remove a document from a Workspace (but keep it in the Knowledge Base).
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if it's actually linked
    if document not in workspace.documents:
        raise HTTPException(status_code=400, detail="Document is not attached to this workspace")

    # Remove the link
    workspace.documents.remove(document)
    
    db.commit()
    
    return {"message": f"Successfully removed '{document.filename}' from '{workspace.name}'"}