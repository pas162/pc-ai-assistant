from typing import List
from app.core.chromadb_client import get_workspace_collection

# ChromaDB has a hard limit of 5461 vectors per upsert call
# We use 5000 to stay safely under the limit
CHROMA_BATCH_SIZE = 5000


def store_document_vectors(
    document_id: str,
    workspace_id: str,
    chunks: List[str],
    embeddings: List[List[float]]
) -> int:
    """
    Save document chunks + their vectors into a workspace's ChromaDB collection.
    Automatically splits into batches of 5000 to respect ChromaDB's size limit.
    Returns the number of chunks stored.
    """
    if not chunks:
        print(f"  No chunks to store for document {document_id}")
        return 0

    # Step 1: Get (or create) the collection for this workspace
    collection = get_workspace_collection(workspace_id)

    # Step 2: Build unique IDs for each chunk
    ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]

    # Step 3: Build metadata for each chunk
    metadatas = [
        {"document_id": document_id, "chunk_index": i}
        for i in range(len(chunks))
    ]

    # Step 4: Store in batches to respect ChromaDB's max batch size limit
    total = len(chunks)
    for batch_start in range(0, total, CHROMA_BATCH_SIZE):
        batch_end = min(batch_start + CHROMA_BATCH_SIZE, total)

        collection.upsert(
            ids=ids[batch_start:batch_end],
            embeddings=embeddings[batch_start:batch_end],
            documents=chunks[batch_start:batch_end],
            metadatas=metadatas[batch_start:batch_end]
        )
        print(f"  Stored chunks {batch_start}–{batch_end} of {total} "
              f"for document {document_id} in workspace {workspace_id}")

    return total


def delete_document_vectors(
    document_id: str,
    workspace_id: str
) -> None:
    """
    Remove all chunks belonging to a document from a workspace's collection.
    Called when:
    - A document is deleted from the Knowledge Base entirely
    - A document is detached from a specific workspace
    """
    collection = get_workspace_collection(workspace_id)

    collection.delete(
        where={"document_id": document_id}
    )

    print(f"  Deleted vectors for document {document_id} "
          f"from workspace {workspace_id}")