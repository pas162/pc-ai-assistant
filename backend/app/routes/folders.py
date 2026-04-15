import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.folder import Folder
from app.models.document import Document
from app.schemas.folder import FolderCreate, FolderResponse
from app.services.vector_store import delete_document_vectors

router = APIRouter(prefix="/folders", tags=["folders"])

UPLOAD_DIR = "uploaded_docs"


@router.post("", response_model=FolderResponse)
def create_folder(body: FolderCreate, db: Session = Depends(get_db)):
    """
    Create an empty folder.
    Path is built from parent_path + name.
    Root folder:  name="java-project"  parent_path=None  → path="java-project"
    Nested folder: name="src"          parent_path="java-project" → path="java-project/src"
    """
    # Build the full path
    if body.parent_path:
        # Verify parent actually exists — can't create orphan folders
        parent = db.query(Folder).filter(
            Folder.path == body.parent_path
        ).first()
        if not parent:
            raise HTTPException(
                status_code=404,
                detail=f"Parent folder '{body.parent_path}' not found"
            )
        full_path = f"{body.parent_path}/{body.name}"
    else:
        full_path = body.name

    # Check for duplicate path
    existing = db.query(Folder).filter(Folder.path == full_path).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Folder '{full_path}' already exists"
        )

    folder = Folder(
        id=str(uuid.uuid4()),
        name=body.name,
        path=full_path
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)

    print(f"[Folders] Created folder: {full_path}")
    return folder


@router.get("", response_model=list[FolderResponse])
def list_folders(db: Session = Depends(get_db)):
    """
    Return all folders as a flat list.
    WHY flat? The frontend builds the tree by splitting paths on "/".
    No recursive DB queries needed.
    """
    return db.query(Folder).order_by(Folder.path).all()


@router.delete("/{folder_id}")
def delete_folder(folder_id: str, db: Session = Depends(get_db)):
    """
    Delete a folder and everything inside it:
      1. Find all nested folders (path starts with this folder's path)
      2. Find all documents in those folders
      3. Delete each document's physical file + vectors
      4. Delete document DB rows
      5. Delete all folder DB rows
    """
    # Step 1: Find the target folder
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    target_path = folder.path

    # Step 2: Find ALL folders under this path (including itself)
    # e.g. target_path = "java-project"
    # matches: "java-project", "java-project/src", "java-project/src/controllers"
    all_folders = db.query(Folder).filter(
        Folder.path.like(f"{target_path}%")
    ).all()
    affected_paths = [f.path for f in all_folders]

    # Step 3: Find all documents in affected folders
    documents = db.query(Document).filter(
        Document.folder_path.in_(affected_paths)
    ).all()

    print(f"[Folders] Deleting '{target_path}': "
          f"{len(all_folders)} folders, {len(documents)} documents")

    # Step 4: For each document — delete file, vectors, DB row
    for doc in documents:
        # 4a. Delete physical file
        file_path = os.path.join(UPLOAD_DIR, f"{doc.id}_{doc.filename}")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"[Folders] Warning: could not delete file {file_path}: {e}")

        # 4b. Delete cache file if exists
        cache_path = os.path.join(UPLOAD_DIR, f"{doc.id}_cache.pkl")
        if os.path.exists(cache_path):
            try:
                os.remove(cache_path)
            except Exception as e:
                print(f"[Folders] Warning: could not delete cache {cache_path}: {e}")

        # 4c. Delete vectors from every workspace this doc belongs to
        for workspace in doc.workspaces:
            try:
                delete_document_vectors(
                    document_id=doc.id,
                    workspace_id=workspace.id
                )
            except Exception as e:
                print(f"[Folders] Warning: could not delete vectors "
                      f"for doc {doc.id} in workspace {workspace.id}: {e}")

        # 4d. Delete document DB row
        db.delete(doc)

    # Step 5: Delete all folder rows
    for f in all_folders:
        db.delete(f)

    db.commit()

    return {
        "message": f"Deleted folder '{target_path}' "
                   f"({len(all_folders)} folders, {len(documents)} documents removed)"
    }