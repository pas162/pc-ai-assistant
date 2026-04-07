from typing import List
from sentence_transformers import SentenceTransformer

print("Loading embedding model...")
_model = SentenceTransformer("all-MiniLM-L6-v2") 
print("Embedding model loaded!")
def get_embedding(text: str) -> List[float]:
    """
    Convert a single piece of text into a vector (list of numbers).
    Uses multi-qa-mpnet-base-dot-v1 — optimized for Q&A retrieval.
    Produces 768-dimensional vectors (vs 384 for MiniLM).
    """
    vector = _model.encode(text)
    return vector.tolist()
def get_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Convert multiple texts into vectors efficiently.
    Processes the whole batch at once — much faster than one by one.
    """
    print(f"  Embedding {len(texts)} chunks...")
    vectors = _model.encode(texts)
    return [v.tolist() for v in vectors]
