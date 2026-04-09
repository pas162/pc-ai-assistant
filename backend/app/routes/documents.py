import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.services.document_processor import process_document  # ← new import
router = APIRouter(prefix="/documents", tags=["documents"])
UPLOAD_DIR = "uploaded_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a new document to the central Knowledge Base.
    Returns immediately with status="pending".
    Processing (extract → chunk → embed) runs in the background.
    """
    # 1. Create the database record FIRST to get the UUID
    db_document = Document(
        filename=file.filename,
        file_type=file.filename.split(".")[-1].lower() if "." in file.filename else "unknown",
        status="pending"
    )
    db.add(db_document)
    db.flush()
    # 2. Save the physical file using the new Document ID
    safe_filename = f"{db_document.id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 3. Update the file size now that it's saved
    db_document.file_size = os.path.getsize(file_path)
    
    # 4. Commit everything
    db.commit()
    db.refresh(db_document)

    # 5. Kick off background processing — runs AFTER response is returned
    #    Like @Async in Spring — fire and forget
    background_tasks.add_task(process_document, db_document.id)  # ← new line

    return db_document  # returns "pending" immediately
@router.get("", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    """
    List all documents in the Knowledge Base.
    """
    return db.query(Document).all()


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """
    Delete a document from the Knowledge Base.
    Also deletes the physical file from disk.
    Also removes all workspace links automatically (CASCADE).
    """
    # Step 1: Find the document record
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Step 2: Delete the physical file from disk
    # We need to find the file using the pattern: {id}_{filename}
    file_path = os.path.join(UPLOAD_DIR, f"{document.id}_{document.filename}")
    if os.path.exists(file_path):
        os.remove(file_path)

    # Step 3: Delete the database record
    # PostgreSQL CASCADE will automatically clean up workspace_documents links
    db.delete(document)
    db.commit()

    return {"message": f"Document '{document.filename}' deleted successfully"}
