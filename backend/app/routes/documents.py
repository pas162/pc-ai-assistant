import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.document import Document
from app.schemas.document import DocumentResponse

# Prefix is now just /documents (Central Knowledge Base)
router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = "uploaded_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    """
    Upload a new document to the central Knowledge Base.
    """
    # 1. Create the database record FIRST to get the UUID
    # We do this so we can name the physical file with the UUID to prevent overwriting
    db_document = Document(
        filename=file.filename,
        file_type=file.filename.split(".")[-1].lower() if "." in file.filename else "unknown",
        status="pending"
    )
    db.add(db_document)
    db.flush() # Flushes to DB to generate the ID, but doesn't commit the transaction yet

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

    return db_document


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
