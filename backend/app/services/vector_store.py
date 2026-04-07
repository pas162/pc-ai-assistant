from typing import List
from app.core.chromadb_client import get_workspace_collection


def store_document_vectors(
    document_id: str,
    workspace_id: str,
    chunks: List[str],
    embeddings: List[List[float]]
) -> int:
    """
    Save document chunks + their vectors into a workspace's ChromaDB collection.

    Think of this like doing INSERT INTO in PostgreSQL,
    but instead of rows, we're inserting vectors for similarity search.

    Returns the number of chunks stored.
    """
    if not chunks:
        print(f"  No chunks to store for document {document_id}")
        return 0

    # Step 1: Get (or create) the collection for this workspace
    collection = get_workspace_collection(workspace_id)

    # Step 2: Build unique IDs for each chunk
    # Format: "{document_id}_chunk_{index}"
    # Example: "abc-123_chunk_0", "abc-123_chunk_1"
    ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]

    # Step 3: Build metadata for each chunk
    # This lets us filter or identify chunks later during retrieval
    metadatas = [
        {
            "document_id": document_id,
            "chunk_index": i
        }
        for i in range(len(chunks))
    ]

    # Step 4: Store everything in ChromaDB
    # upsert = insert if not exists, update if already exists
    # Safer than .add() which throws an error on duplicate IDs
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas
    )

    print(f"  Stored {len(chunks)} chunks for document {document_id} in workspace {workspace_id}")
    return len(chunks)


def delete_document_vectors(
    document_id: str,
    workspace_id: str
) -> None:
    """
    Remove all chunks belonging to a document from a workspace's collection.

    Called when:
    - A document is deleted from the Knowledge Base entirely
    - A document is detached from a specific workspace

    Think of this like DELETE FROM WHERE document_id = ? in PostgreSQL.
    """
    collection = get_workspace_collection(workspace_id)

    # ChromaDB's .delete() with 'where' filters by metadata
    # This finds all chunks where metadata.document_id matches
    collection.delete(
        where={"document_id": document_id}
    )

    print(f"  Deleted vectors for document {document_id} from workspace {workspace_id}")