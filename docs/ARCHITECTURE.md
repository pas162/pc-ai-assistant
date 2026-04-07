# PC-AI-Assistant: System Architecture

## Tech Stack
- **Backend:** Python 3.14 + FastAPI (port 8000)
- **Frontend:** React + TypeScript + Tailwind CSS (port 3000)
- **Database:** PostgreSQL (port 5432) + ChromaDB (port 8001)
- **LLM API:** http://10.210.106.4:8080 (model: databricks-gemini-3-1-flash-lite)
- **HTTP Client:** httpx (for calling LLM API)

## Key Python Packages
| Package | Version | Purpose |
|---|---|---|
| fastapi | 0.115.0 | Web framework |
| uvicorn | 0.30.6 | ASGI server |
| sqlalchemy | 2.0.35 | ORM (like Hibernate in Java) |
| psycopg2-binary | 2.9.11 | PostgreSQL driver |
| alembic | 1.13.3 | Database migrations |
| chromadb | 1.5.5 | Vector database client |
| httpx | 0.27.0 | HTTP client for LLM API calls |
| python-multipart | 0.0.24 | File upload support |
| pydantic-settings | 2.4.0 | .env config management |
| PyMuPDF | 1.24.9 | Extract text from PDF files |
| python-docx | 1.1.2 | Extract text from DOCX files |
| sentence-transformers | 3.0.1 | Local embedding model (all-MiniLM-L6-v2) |

## Embedding Model
- **Model:** `all-MiniLM-L6-v2` (currently for testing)
- **Planned upgrade:** `multi-qa-mpnet-base-dot-v1` (for production)
- **Vector dimensions:** 384
- **Runs locally** — no API calls needed for embeddings
- **Cached at:** `C:\Users\{user}\.cache\huggingface\hub\`
## Database Schema (PostgreSQL)

We use a **Many-to-Many** relationship between Workspaces and Documents.

### Tables

1. **`workspaces`**
   - `id` (UUID, Primary Key)
   - `name` (String)
   - `description` (String, nullable)
   - `created_at` (DateTime)
   - `updated_at` (DateTime)

2. **`documents`**
   - `id` (UUID, Primary Key)
   - `filename` (String)
   - `file_type` (String, e.g. "pdf", "txt", "docx")
   - `file_size` (Integer, bytes)
   - `status` (String: "pending" → "processing" → "completed" / "failed")
   - `created_at` (DateTime)

3. **`workspace_documents` (Junction / Link Table)**
   - `workspace_id` (UUID, Foreign Key → workspaces.id, CASCADE DELETE)
   - `document_id` (UUID, Foreign Key → documents.id, CASCADE DELETE)
   - Primary Key is the combination of (`workspace_id`, `document_id`)

> **Java/Hibernate Equivalent:**
> This is a `@ManyToMany` relationship using a `@JoinTable`.
> CASCADE DELETE means removing a workspace or document automatically cleans up the link table.

## File Storage
- Uploaded files are saved to `backend/uploaded_docs/`
- Files are named as `{document_id}_{original_filename}` to prevent collisions
- This folder is excluded from Git (`.gitignore`)

## LLM Integration
- LLM API is called via `backend/app/core/llm_client.py`
- Uses `httpx` (sync HTTP client) with Bearer token auth
- Token is stored in `.env` as `LLM_API_TOKEN`
- Main function: `chat_with_llm(messages: list)` → returns string response
- **Note:** LLM API does NOT support embeddings endpoint (returns 400)
- Embeddings are handled locally via `sentence-transformers`

## Vector Database (ChromaDB)
- Running in Docker on port 8001
- ChromaDB version: 1.5.5 (newer versions incompatible with Python 3.14)
- When a document is processed, its chunks + vectors are stored in ChromaDB
- ChromaDB metadata stores `document_id` and `chunk_index`
- During chat, ChromaDB filters by `document_ids` attached to the workspace

## RAG Pipeline (Planned — Sprint 3)