"""
Run this script ONCE after changing the embedding model.
It deletes all ChromaDB collections and .pkl cache files
so they can be rebuilt with the new model's dimensions.

Usage:
    cd backend
    python reset_vectors.py
"""
import os
import chromadb

UPLOAD_DIR = "uploaded_docs"

def reset():
    # ── Step 1: Delete all ChromaDB collections ───────────────────────────
    print("Connecting to ChromaDB...")
    client = chromadb.HttpClient(host="127.0.0.1", port=8001)

    collections = client.list_collections()
    if not collections:
        print("No ChromaDB collections found.")
    else:
        for col in collections:
            client.delete_collection(col.name)
            print(f"  Deleted collection: {col.name}")

    # ── Step 2: Delete all .pkl cache files ───────────────────────────────
    print("\nCleaning up .pkl cache files...")
    if not os.path.exists(UPLOAD_DIR):
        print(f"  Upload dir '{UPLOAD_DIR}' not found — skipping.")
    else:
        deleted = 0
        for filename in os.listdir(UPLOAD_DIR):
            if filename.endswith("_cache.pkl"):
                path = os.path.join(UPLOAD_DIR, filename)
                os.remove(path)
                print(f"  Deleted cache: {filename}")
                deleted += 1
        if deleted == 0:
            print("  No .pkl cache files found.")

    print("\n✅ Reset complete!")
    print("Next steps:")
    print("  1. Restart uvicorn — new model will download automatically")
    print("  2. Re-upload or re-process all documents")

if __name__ == "__main__":
    reset()