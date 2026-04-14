from typing import List
from app.core.chromadb_client import get_workspace_collection
from app.services.embedder import get_embedding


def retrieve_relevant_chunks(
    question: str,
    workspace_id: str,
    n_results: int = 15
) -> List[str]:
    """
    Find the most relevant text chunks for a given question.

    This is the 'R' in RAG — Retrieval Augmented Generation.

    Steps:
    1. Embed the question into a vector (same model as documents)
    2. Ask ChromaDB: "which stored vectors are most similar to this?"
    3. Return the matching chunk texts

    Think of it like a semantic search — not keyword matching,
    but meaning matching. "car" would match "automobile" for example.

    Args:
        question:     The user's question
        workspace_id: Only search chunks from this workspace
        n_results:    How many chunks to retrieve (default 5)

    Returns:
        List of relevant text chunks, ordered by similarity
    """
    # Step 1: Embed the question using the same model as the documents
    # IMPORTANT: Must use the same model — vectors only compare correctly
    # if they were created by the same model
    question_vector = get_embedding(question)

    # Step 2: Get this workspace's ChromaDB collection
    collection = get_workspace_collection(workspace_id)

    # Step 3: Check how many chunks are actually stored
    # If we ask for 5 results but only 3 are stored, ChromaDB will error
    count = collection.count()
    if count == 0:
        return []

    # Clamp n_results to however many chunks exist
    actual_n = min(n_results, count)

    # Step 4: Query ChromaDB for most similar chunks
    # ChromaDB compares question_vector against all stored vectors
    # and returns the closest ones (by cosine similarity)
    results = collection.query(
        query_embeddings=[question_vector],
        n_results=actual_n,
        include=["documents", "metadatas"]
    )

    # results["documents"] is a list of lists — one list per query
    # We only sent one query, so take index [0]
    chunks = results["documents"][0]

    return chunks


def build_context(chunks: List[str]) -> str:
    """
    Format retrieved chunks into a single context string for the LLM.

    Instead of sending raw chunks, we format them clearly so the LLM
    understands these are reference documents, not part of the conversation.

    Args:
        chunks: List of relevant text chunks from ChromaDB

    Returns:
        A formatted string ready to inject into the LLM prompt
    """
    if not chunks:
        return "No relevant documents found."

    # Number each chunk so the LLM can reference them
    formatted = []
    for i, chunk in enumerate(chunks, 1):
        formatted.append(f"[Chunk {i}]\n{chunk}")

    return "\n\n---\n\n".join(formatted)