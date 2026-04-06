# PC-AI-Assistant: System Architecture

## Database Schema (PostgreSQL)

We use a **Many-to-Many** relationship between Workspaces and Documents.

### Tables

1. **`workspaces`**
   - `id` (UUID, Primary Key)
   - `name` (String)
   - `description` (String)

2. **`documents`**
   - `id` (UUID, Primary Key)
   - `filename` (String)
   - `file_type` (String)
   - `status` (String)
   *(Note: `workspace_id` is REMOVED from this table)*

3. **`workspace_documents` (Junction / Link Table)**
   - `workspace_id` (UUID, Foreign Key)
   - `document_id` (UUID, Foreign Key)
   - Primary Key is the combination of (`workspace_id`, `document_id`)

> **Java/Hibernate Equivalent:** 
> This is a `@ManyToMany` relationship using a `@JoinTable`.

## Vector Database (ChromaDB)
When a document is uploaded, its text is extracted, split into chunks, converted to vectors (embeddings), and saved in ChromaDB. 
- ChromaDB metadata will store the `document_id`.
- During a chat, the backend will tell ChromaDB: *"Search for this query, but ONLY filter by these document_ids (the ones attached to the current workspace)."*