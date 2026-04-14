import os
import time
import pickle
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.document import Document
from app.services.text_extractor import extract_text, ExtractionCancelled
from app.services.text_chunker import chunk_document
from app.services.embedder import get_embeddings_batch

UPLOAD_DIR = "uploaded_docs"
EMBEDDING_BATCH_SIZE = 100

def _update_progress(db: Session, document_id: str, progress: int, status: str = None) -> bool:
    """Returns True if successful, False if document was deleted (canceled)."""
    
    # 1. Check if document still exists
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return False  # Document is gone! User canceled.
    
    # 2. Prepare the exact fields to update
    update_data = {"progress": progress}
    if status:
        update_data["status"] = status
        
    # 3. FORCE the SQL UPDATE command directly (bypasses SQLAlchemy tracking)
    db.query(Document).filter(Document.id == document_id).update(update_data)
    db.commit()
    
    return True

def _cleanup_files(document_id: str, filename: str):
    """
    Delete physical files left on disk after a cancel or failure.
    Safe to call even if files don't exist.
    """
    paths = [
        os.path.join(UPLOAD_DIR, f"{document_id}_{filename}"),  # PDF
        os.path.join(UPLOAD_DIR, f"{document_id}_cache.pkl"),   # cache
    ]
    for path in paths:
        if os.path.exists(path):
            # Retry loop — file may still be locked briefly
            for attempt in range(5):
                try:
                    os.remove(path)
                    print(f"[Processor] Cleaned up: {path}")
                    break
                except PermissionError:
                    time.sleep(0.5)
            else:
                print(f"[Processor] WARNING: Could not delete {path} after 5 attempts")
        
def process_document(document_id: str):
    db: Session = SessionLocal()
    filename = None  # ← track filename for cleanup
    try:
        if not _update_progress(db, document_id, 0, status="processing"):
            return

        document = db.query(Document).filter(Document.id == document_id).first()
        filename = document.filename  # ← save before anything can go wrong
        file_path = os.path.join(UPLOAD_DIR, f"{document.id}_{document.filename}")

        # 1. Extract Text (0% → 30%)
        def on_extraction_progress(current_page: int, total_pages: int):
            progress = int((current_page / total_pages) * 30)
            is_active = _update_progress(db, document_id, progress)
            if not is_active:
                print(f"[Processor] Cancel detected at page {current_page}/{total_pages}")
                raise ExtractionCancelled()

        try:
            text = extract_text(
                file_path,
                document.file_type,
                on_progress=on_extraction_progress
            )
        except ExtractionCancelled:
            print(f"[Processor] Document {document_id} cancelled during extraction")
            _cleanup_files(document_id, filename)  # ← clean up PDF + cache
            return  # ← clean exit

        if not text.strip():
            raise ValueError("No text extracted")

        # 2. Chunk (33%)
        chunk_dicts = chunk_document(text, document_id=document.id)
        chunk_texts = [c["text"] for c in chunk_dicts]
        if not _update_progress(db, document_id, 33):
            _cleanup_files(document_id, filename)  # ← cancel during chunking
            return

        # 3. Embeddings (33% → 95%)
        all_embeddings = []
        total_chunks = len(chunk_texts)

        for batch_start in range(0, total_chunks, EMBEDDING_BATCH_SIZE):
            batch_end = min(batch_start + EMBEDDING_BATCH_SIZE, total_chunks)
            batch = chunk_texts[batch_start:batch_end]

            batch_embeddings = get_embeddings_batch(batch)
            all_embeddings.extend(batch_embeddings)

            progress = int(33 + ((batch_end / total_chunks) * 62))
            is_active = _update_progress(db, document_id, progress)
            if not is_active:
                print(f"[Processor] Document {document_id} cancelled during embeddings")
                _cleanup_files(document_id, filename)  # ← cancel during embeddings
                return

        # 4. Cache (95% → 100%)
        cache_path = os.path.join(UPLOAD_DIR, f"{document.id}_cache.pkl")
        with open(cache_path, "wb") as f:
            pickle.dump({"chunks": chunk_texts, "embeddings": all_embeddings}, f)

        _update_progress(db, document_id, 100, status="completed")

    except Exception as e:
        print(f"[Processor] Processing failed: {e}")
        if filename:
            _cleanup_files(document_id, filename)  # ← clean up on any error too
        _update_progress(db, document_id, 0, status="failed")
    finally:
        db.close()