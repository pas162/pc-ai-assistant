import chromadb
from app.core.config import get_settings

settings = get_settings()


def get_chroma_client():
    """
    Creates and returns a ChromaDB client.
    Connects to ChromaDB running in Docker.
    """
    client = chromadb.HttpClient(
        host="127.0.0.1",
        port=8001
    )
    return client


def get_workspace_collection(workspace_id: str):
    """
    Gets (or creates) a ChromaDB collection for a workspace.
    Each workspace has its own collection — like its own search index.

    Think of a collection like a table in PostgreSQL,
    but for vector/similarity search instead of exact queries.
    """
    client = get_chroma_client()

    # get_or_create means:
    # - if collection exists → return it
    # - if not → create it first, then return it
    collection = client.get_or_create_collection(
        name=f"workspace_{workspace_id}",
        metadata={"workspace_id": workspace_id}
    )
    return collection