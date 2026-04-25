from typing import List, Optional
from app.core.chromadb_client import get_workspace_collection
from app.services.embedder import get_embedding


def retrieve_relevant_chunks(
    question: str,
    workspace_id: str,
    n_results: int = 15,
    filter_doc_id: Optional[str] = None,
) -> List[dict]:
    """
    Returns list of dicts:
        { "text": str, "document_id": str }

    If filter_doc_id is provided, only chunks from that document are returned.
    """
    question_vector = get_embedding(question)
    collection = get_workspace_collection(workspace_id)

    count = collection.count()
    if count == 0:
        return []

    if filter_doc_id:
        try:
            doc_count = collection.count(where={"document_id": filter_doc_id})
            if doc_count == 0:
                print(f"  No chunks found in ChromaDB for doc: {filter_doc_id}")
                return []
            actual_n = min(n_results, doc_count)
        except Exception:
            actual_n = min(n_results, count)
    else:
        actual_n = min(n_results, count)

    query_kwargs = {
        "query_embeddings": [question_vector],
        "n_results": actual_n,
        "include": ["documents", "metadatas"],
    }
    if filter_doc_id:
        query_kwargs["where"] = {"document_id": filter_doc_id}

    results = collection.query(**query_kwargs)
    chunks = results["documents"][0]
    metadatas = results["metadatas"][0]

    return [
        {"text": chunk, "document_id": meta.get("document_id", "")}
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