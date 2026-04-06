# PC-AI-Assistant: System Architecture

## Tech Stack

- **Backend:** Python 3.14 + FastAPI (port 8000)
- **Frontend:** React + TypeScript + Tailwind CSS (port 3000)
- **Database:** PostgreSQL (port 5432) + ChromaDB (port 8001)
- **LLM API:** http://10.210.106.4:8080 (model: databricks-gemini-3-1-flash-lite)
- **HTTP Client:** httpx (for calling LLM API)

## Key Python Packages

| Package           | Version | Purpose                       |
| ----------------- | ------- | ----------------------------- |
| fastapi           | 0.115.0 | Web framework                 |
| uvicorn           | 0.30.6  | ASGI server                   |
| sqlalchemy        | 2.0.35  | ORM (like Hibernate in Java)  |
| psycopg2-binary   | 2.9.11  | PostgreSQL driver             |
| alembic           | 1.13.3  | Database migrations           |
| chromadb          | 1.5.5   | Vector database client        |
| httpx             | 0.27.0  | HTTP client for LLM API calls |
| python-multipart  | 0.0.24  | File upload support           |
| pydantic-settings | 2.4.0   | .env config management        |

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

## API Endpoints
| Method | URL | Purpose |
|---|---|---|
| GET | /health | Health check |
| GET | /test-llm | Test LLM connection |
| POST | /workspaces | Create workspace |
| GET | /workspaces | List all workspaces |
| GET | /workspaces/{id} | Get one workspace |
| PUT | /workspaces/{id} | Update workspace |
| DELETE | /workspaces/{id} | Delete workspace |
| POST | /workspaces/{id}/documents/{doc_id} | Link document to workspace |
| DELETE | /workspaces/{id}/documents/{doc_id} | Unlink document from workspace |
| POST | /documents | Upload document to Knowledge Base |
| GET | /documents | List all documents |
| DELETE | /documents/{id} | Delete document from Knowledge Base |

## File Storage

- Uploaded files are saved to `backend/uploaded_docs/`
- Files are named as `{document_id}_{original_filename}` to prevent collisions
- This folder is excluded from Git (`.gitignore`)

## LLM Integration

- LLM API is called via `backend/app/core/llm_client.py`
- Uses `httpx` (sync HTTP client) with Bearer token auth
- Token is stored in `.env` as `LLM_API_TOKEN`
- Main function: `chat_with_llm(messages: list)` → returns string response

## Vector Database (ChromaDB)

When a document is uploaded, its text is extracted, split into chunks,
converted to vectors (embeddings), and saved in ChromaDB.

- ChromaDB metadata will store the `document_id`.
- During a chat, the backend will tell ChromaDB:
  _"Search for this query, but ONLY filter by these document_ids
  (the ones attached to the current workspace)."_

## RAG Pipeline (Planned — Sprint 3)
