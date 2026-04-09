import os
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.document import Document
from app.services.text_extractor import extract_text
from app.services.text_chunker import chunk_document
from app.services.embedder import get_embeddings_batch
from app.services.vector_store import store_document_vectors

UPLOAD_DIR = "uploaded_docs"


def process_document(document_id: str):
    """
    Full processing pipeline for an uploaded document.
    Runs as a background task — AFTER the upload response is returned.

    Steps:
    1. Set status → "processing"
    2. Extract text from file
    3. Chunk the text
    4. Generate embeddings
    5. Store vectors in ChromaDB (for every workspace this doc is in)
    6. Set status → "completed"

    On any error → set status = "failed"
    """
    # Background tasks run outside the request context,
    # so we need to create a NEW database session here.
    # Think of it like opening a new JDBC connection in a background thread.
    db: Session = SessionLocal()

    try:
        # ── Step 1: Mark as processing ───────────────────────────────────────
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            print(f"[Processor] Document {document_id} not found — skipping")
            return

        document.status = "processing"
        db.commit()
        print(f"[Processor] Starting processing for: {document.filename}")

        # ── Step 2: Extract text ─────────────────────────────────────────────
        file_path = os.path.join(UPLOAD_DIR, f"{document.id}_{document.filename}")
        print(f"[Processor] Extracting text from: {file_path}")
        text = extract_text(file_path, document.file_type)

        if not text.strip():
            raise ValueError("No text could be extracted from this file")

        print(f"[Processor] Extracted {len(text)} characters")

        # ── Step 3: Chunk the text ───────────────────────────────────────────
        chunks = chunk_document(text, document_id=document.id)
        print(f"[Processor] Created {len(chunks)} chunks")

        # ── Step 4: Generate embeddings ──────────────────────────────────────
        chunk_texts = [c["text"] for c in chunks]
        print(f"[Processor] Generating embeddings for {len(chunk_texts)} chunks...")
        embeddings = get_embeddings_batch(chunk_texts)
        print(f"[Processor] Embeddings done")

        # ── Step 5: Store vectors in ChromaDB ────────────────────────────────
        # A document can be attached to multiple workspaces.
        # We store vectors in EACH workspace's ChromaDB collection.
        # Re-fetch with relationships loaded
        document = db.query(Document).filter(Document.id == document_id).first()
        workspaces = document.workspaces  # Many-to-Many relationship

        if workspaces:
            for workspace in workspaces:
                print(f"[Processor] Storing vectors in workspace: {workspace.name}")
                store_document_vectors(
                    document_id=document.id,
                    workspace_id=workspace.id,
                    chunks=chunk_texts,
                    embeddings=embeddings,
                )
        else:
            # Document not yet attached to any workspace — that's fine.
            # Vectors will be stored when it gets attached later.
            print(f"[Processor] No workspaces attached yet — skipping vector store")

        # ── Step 6: Mark as completed ────────────────────────────────────────
        document.status = "completed"
        db.commit()
        print(f"[Processor] Completed: {document.filename}")

    except Exception as e:
        # On ANY error — mark as failed so the user knows
        print(f"[Processor] FAILED processing {document_id}: {str(e)}")
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.status = "failed"
                db.commit()
        except Exception as inner_e:
            print(f"[Processor] Could not update status to failed: {inner_e}")

    finally:
        # Always close the session — like closing a JDBC connection
        db.close()