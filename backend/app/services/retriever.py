from typing import List
from app.core.chromadb_client import get_workspace_collection
from app.services.embedder import get_embedding


# ── New return type — chunks with their source document IDs ──────────────────
def retrieve_relevant_chunks(
    question: str,
    workspace_id: str,
    n_results: int = 15
) -> List[dict]:
    """
    Returns list of dicts:
        { "text": str, "document_id": str }
    """
    question_vector = get_embedding(question)
    collection = get_workspace_collection(workspace_id)

    count = collection.count()
    if count == 0:
        return []

    actual_n = min(n_results, count)

    results = collection.query(
        query_embeddings=[question_vector],
        n_results=actual_n,
        include=["documents", "metadatas"]
    )

    chunks = results["documents"][0]
    metadatas = results["metadatas"][0]

    # Zip chunks with their source document_id from metadata
    return [
        {
            "text": chunk,
            "document_id": meta.get("document_id", "")
        }
        for chunk, meta in zip(chunks, metadatas)
    ]


def build_context(chunks: List[dict]) -> str:
    """
    Build context string from chunk dicts for the LLM prompt.
    """
    if not chunks:
        return "No relevant documents found."

    formatted = []
    for i, chunk in enumerate(chunks, 1):
        formatted.append(f"[Chunk {i}]\n{chunk['text']}")

    return "\n\n---\n\n".join(formatted)