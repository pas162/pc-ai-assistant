import re
from typing import List, Optional

CODE_EXTENSIONS = {"java", "py", "ts", "tsx", "js", "jsx", "kt", "cs", "cpp", "c", "go"}

BLOCK_BOUNDARY = re.compile(
    r'(?m)^[ \t]*(?:'
    r'(?:public|private|protected|static|final|abstract|override|async|'
    r'synchronized|native|strictfp)\s+)*'
    r'(?:class|interface|enum|record|'
    r'def |fun |func |'
    r'(?:void|int|long|double|float|boolean|String|[A-Z]\w*)\s+\w+\s*\()'
)


def chunk_code(text: str, document_id: str) -> List[dict]:
    """
    Split source code at class/method/function boundaries.
    Each chunk is one logical unit (class declaration, method body, etc.).
    Falls back to fixed-size chunking when no structure is detected.
    """
    boundaries = [m.start() for m in BLOCK_BOUNDARY.finditer(text)]

    if len(boundaries) < 2:
        return chunk_document_fixed(text, document_id)

    raw_chunks = []
    for i, start in enumerate(boundaries):
        end = boundaries[i + 1] if i + 1 < len(boundaries) else len(text)
        block = text[start:end].strip()
        if block:
            raw_chunks.append(block)

    final: List[dict] = []
    idx = 0
    for block in raw_chunks:
        if len(block) > 4000:
            sub = chunk_text(block, chunk_size=2000, overlap=200)
            for s in sub:
                final.append({"text": s, "document_id": document_id, "chunk_index": idx})
                idx += 1
        else:
            final.append({"text": block, "document_id": document_id, "chunk_index": idx})
            idx += 1

    return final


def chunk_document_fixed(text: str, document_id: str) -> List[dict]:
    """Fixed-size overlapping chunker for prose documents."""
    chunks = chunk_text(text, chunk_size=1000, overlap=150)
    return [
        {"text": chunk, "document_id": document_id, "chunk_index": i}
        for i, chunk in enumerate(chunks)
    ]


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 150
) -> List[str]:
    """
    Split a long text into smaller overlapping chunks.

    Think of it like a sliding window moving across the text.

    Args:
        text:       The full extracted text from a document
        chunk_size: How many characters per chunk (default 500)
        overlap:    How many characters to repeat between chunks (default 50)
                    This prevents answers from being split across chunk boundaries

    Returns:
        A list of text chunks

    Example with chunk_size=20, overlap=5:
        text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        chunks = ["ABCDEFGHIJKLMNOPQRST",    (0 to 20)
                  "PQRSTUVWXYZ..."]           (15 to 35) ← starts 5 chars back
    """
    if not text or not text.strip():
        return []

    # Step 1: Clean up the text
    # Remove excessive blank lines (more than 2 in a row)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()

    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        # Calculate end position of this chunk
        end = start + chunk_size

        # If this is not the last chunk, try to find a good
        # "break point" — end at a sentence or paragraph boundary
        # instead of cutting in the middle of a word
        if end < text_length:
            # Look for a paragraph break first (best break point)
            paragraph_break = text.rfind('\n\n', start, end)
            if paragraph_break != -1 and paragraph_break > start + (chunk_size // 2):
                end = paragraph_break

            # If no paragraph break, look for a sentence end
            else:
                sentence_break = max(
                    text.rfind('. ', start, end),
                    text.rfind('! ', start, end),
                    text.rfind('? ', start, end),
                )
                if sentence_break != -1 and sentence_break > start + (chunk_size // 2):
                    end = sentence_break + 1  # include the period

        # Extract the chunk and clean it up
        chunk = text[start:end].strip()

        # Only add non-empty chunks
        if chunk:
            chunks.append(chunk)

        # Move start forward, but step BACK by 'overlap' characters
        # This creates the sliding window overlap
        start = end - overlap

    return chunks


def chunk_document(
    text: str,
    document_id: str,
    file_type: Optional[str] = None,
) -> List[dict]:
    """
    Route to the appropriate chunker based on file type.
    Code files (.java, .py, .ts, etc.) use boundary-aware chunking.
    All other files use fixed-size overlapping chunking.
    """
    ext = (file_type or "").lower().lstrip(".")
    if ext in CODE_EXTENSIONS:
        print(f"  Using code-aware chunker for .{ext} file")
        return chunk_code(text, document_id)
    return chunk_document_fixed(text, document_id)