import os
import pickle
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.document import Document
from app.services.text_extractor import extract_text
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

def process_document(document_id: str):
    db: Session = SessionLocal()
    try:
        if not _update_progress(db, document_id, 0, status="processing"):
            return
        
        document = db.query(Document).filter(Document.id == document_id).first()
        file_path = os.path.join(UPLOAD_DIR, f"{document.id}_{document.filename}")
        
        # 1. Extract Text (10%)
        text = extract_text(file_path, document.file_type)
        if not text.strip():
            raise ValueError("No text extracted")
        if not _update_progress(db, document_id, 10):
            return

        # 2. Chunk Text (30%)
        chunk_dicts = chunk_document(text, document_id=document.id)
        chunk_texts = [c["text"] for c in chunk_dicts]
        if not _update_progress(db, document_id, 30):
            return

        # 3. Embeddings in batches (30% -> 95%)
        all_embeddings = []
        total_chunks = len(chunk_texts)
        
        for batch_start in range(0, total_chunks, EMBEDDING_BATCH_SIZE):
            batch_end = min(batch_start + EMBEDDING_BATCH_SIZE, total_chunks)
            batch = chunk_texts[batch_start:batch_end]
            
            batch_embeddings = get_embeddings_batch(batch)
            all_embeddings.extend(batch_embeddings)
            
            progress = int(30 + ((batch_end / total_chunks) * 65))

            # CHECK IF CANCELED AFTER EVERY BATCH!
            is_active = _update_progress(db, document_id, progress)
            if not is_active:
                print(f"[Processor] Document {document_id} was canceled. Stopping CPU work.")
                return # ← EXIT THE THREAD EARLY!

        # 4. Cache the results to disk so 'attach' is instant (95% -> 100%)
        cache_path = os.path.join(UPLOAD_DIR, f"{document.id}_cache.pkl")
        with open(cache_path, "wb") as f:
            pickle.dump({"chunks": chunk_texts, "embeddings": all_embeddings}, f)

        _update_progress(db, document_id, 100, status="completed")

    except Exception as e:
        print(f"Processing failed: {e}")
        _update_progress(db, document_id, 0, status="failed")
    finally:
        db.close()