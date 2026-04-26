from typing import List
from sentence_transformers import SentenceTransformer

MODEL_NAME = "jinaai/jina-embeddings-v2-base-code"
EMBEDDING_DIM = 768

print("Loading embedding model...")
_model = SentenceTransformer(MODEL_NAME, trust_remote_code=True)
print("Embedding model loaded!")


def get_embedding(text: str) -> List[float]:
    """
    Uses jinaai/jina-embeddings-v2-base-code.
    Trained on code (Java, Python, JS, Go, etc.) + natural language.
    8192-token context window — handles full Java classes without truncation.
    Produces 768-dimensional vectors.
    """
    vector = _model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def get_embeddings_batch(texts: List[str]) -> List[List[float]]:
    print(f"  Embedding {len(texts)} chunks...")
    vectors = _model.encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vectors]
