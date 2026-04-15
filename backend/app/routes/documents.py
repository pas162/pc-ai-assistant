import os
import time
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.services.document_processor import process_document

router = APIRouter(prefix="/documents", tags=["documents"])
UPLOAD_DIR = "uploaded_docs"
ALLOWED_EXTENSIONS = {
    # Documents (existing)
    "pdf", "txt", "md", "csv", "docx", "xlsx",
    # Code files (new)
    "py", "java", "js", "ts", "html", "css",
    "json", "yaml", "yml", "xml", "mdf",
    "sql", "sh", "bat", "cs", "cpp", "c", "h"
}

os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    folder_path: str | None = Form(default=None)
):
    """
    Upload a new document to the central Knowledge Base.
    Returns immediately with status="pending".
    Processing (extract → chunk → embed) runs in the background.
    """
    # WHY os.path.basename? When uploading a folder, the browser sends
    # file.filename as the full relative path e.g. "src/com/example/Main.java"
    # We only want "Main.java" as the stored filename.
    # The folder information is already captured in folder_path separately.
    clean_filename = os.path.basename(file.filename.replace("\\", "/"))
    # 0. Validate file type
    file_type = clean_filename.split(".")[-1].lower() if "." in clean_filename else "unknown"
    if file_type not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{file_type}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # 0b. Validate folder_path exists if provided
    if folder_path:
        from app.models.folder import Folder
        folder = db.query(Folder).filter(Folder.path == folder_path).first()
        if not folder:
            raise HTTPException(
                status_code=404,
                detail=f"Folder '{folder_path}' not found"
            )

    # 1. Create DB record using clean filename
    db_document = Document(
        filename=clean_filename,        # ← clean name only, no path
        file_type=file_type,
        status="pending",
        folder_path=folder_path
    )
    db.add(db_document)
    db.flush()

    # 2. Save physical file using clean filename
    safe_filename = f"{db_document.id}_{clean_filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 3. Update the file size now that it's saved
    db_document.file_size = os.path.getsize(file_path)

    # 4. Commit everything
    db.commit()
    db.refresh(db_document)

    # 5. Trigger background processing!
    background_tasks.add_task(process_document, db_document.id)

    return db_document  # returns "pending" immediately


@router.get("", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    """
    List all documents in the Knowledge Base.
    """
    return db.query(Document).all()


def _safe_remove(file_path: str, retries: int = 8, delay: float = 0.5):
    """
    Delete a file with retry logic for Windows file locks.
    Windows locks files when they are open by another process (e.g. pdfplumber).
    Retries up to `retries` times, waiting `delay` seconds between attempts.
    """
    for attempt in range(retries):
        try:
            os.remove(file_path)
            return  # ✅ success
        except PermissionError:
            if attempt < retries - 1:
                print(f"[Delete] File locked, retrying ({attempt + 1}/{retries})...")
                time.sleep(delay)
            else:
                print(f"[Delete] Could not delete file after {retries} attempts: {file_path}")
                raise  # re-raise on final attempt so caller knows it failed


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

    is_processing = document.status in ("pending", "processing")
    # Step 2: Delete the database record FIRST
    # This acts as the cancel signal for the background processor
    db.delete(document)
    db.commit()

    # Step 3: Only delete files immediately if NOT being processed
    # If processing, the background processor will clean up its own files
    if not is_processing:
        file_path = os.path.join(UPLOAD_DIR, f"{document.id}_{document.filename}")
        if os.path.exists(file_path):
            _safe_remove(file_path)

        cache_path = os.path.join(UPLOAD_DIR, f"{document.id}_cache.pkl")
        if os.path.exists(cache_path):
            _safe_remove(cache_path)

    return {"message": f"Document '{document.filename}' deleted successfully"}
