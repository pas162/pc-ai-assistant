import fitz  # PyMuPDF — 'fitz' is the internal name of the PyMuPDF library
import docx  # python-docx
import os


def extract_text(file_path: str, file_type: str) -> str:
    """
    Extract raw text from a file based on its type.
    
    Think of this like a Java Strategy Pattern:
    - Different strategy for each file type
    - All strategies return the same thing: a plain string of text
    
    Args:
        file_path: Full path to the file on disk
        file_type: "pdf", "docx", "txt", etc.
    
    Returns:
        Extracted text as a single string
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    if file_type == "pdf":
        return _extract_from_pdf(file_path)
    elif file_type == "docx":
        return _extract_from_docx(file_path)
    elif file_type in ("txt", "md", "csv"):
        return _extract_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def _extract_from_pdf(file_path: str) -> str:
    """
    Extract text from a PDF file using PyMuPDF.
    Loops through every page and collects all the text.
    """
    text_parts = []

    # fitz.open() is like opening a file handle in Java
    with fitz.open(file_path) as pdf:
        total_pages = len(pdf)
        for page_num, page in enumerate(pdf):
            page_text = page.get_text()  # Extract text from this page
            if page_text.strip():        # Skip empty pages
                # Add page marker so we know where text came from
                text_parts.append(f"[Page {page_num + 1} of {total_pages}]\n{page_text}")

    return "\n\n".join(text_parts)


def _extract_from_docx(file_path: str) -> str:
    """
    Extract text from a DOCX file using python-docx.
    A DOCX file is actually a ZIP file containing XML.
    python-docx handles all that complexity for us.
    """
    doc = docx.Document(file_path)
    
    # Each paragraph is like a line or block of text in the document
    paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
    
    return "\n\n".join(paragraphs)


def _extract_from_txt(file_path: str) -> str:
    """
    Extract text from a plain text file.
    Simple file read — no special library needed.
    """
    # Try UTF-8 first, fall back to latin-1 if it fails
    # (some files have special characters that break UTF-8)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        with open(file_path, "r", encoding="latin-1") as f:
            return f.read()