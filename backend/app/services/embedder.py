from typing import List
from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-base-en-v1.5"  # was: mixedbread-ai/mxbai-embed-large-v1
EMBEDDING_DIM = 768                    # was: 1024

print("Loading embedding model...")
_model = SentenceTransformer(MODEL_NAME)
print("Embedding model loaded!")

def get_embedding(text: str) -> List[float]:
    """
    Uses BAAI/bge-base-en-v1.5
    Best retrieval model under 2GB RAM.
    Produces 768-dimensional vectors.
    """
    vector = _model.encode(text, normalize_embeddings=True)
    return vector.tolist()

def get_embeddings_batch(texts: List[str]) -> List[List[float]]:
    print(f"  Embedding {len(texts)} chunks...")
    vectors = _model.encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vectors]
