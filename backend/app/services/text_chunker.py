from typing import List


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
    import re
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
    chunk_size: int = 500,
    overlap: int = 50
) -> List[dict]:
    """
    Chunk a document's text and attach metadata to each chunk.
    The metadata is what gets stored in ChromaDB alongside the vector.

    Returns a list of dicts, each containing:
        - text:        The chunk text
        - document_id: Which document this came from
        - chunk_index: Position of this chunk in the document (0, 1, 2...)
    """
    chunks = chunk_text(text, chunk_size, overlap)

    return [
        {
            "text": chunk,
            "document_id": document_id,
            "chunk_index": index,
        }
        for index, chunk in enumerate(chunks)
    ]