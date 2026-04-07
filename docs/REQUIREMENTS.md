# PC-AI-Assistant: Product Requirements

## Overview

An internal AI platform that allows users to upload documents to a central
Knowledge Base, create Workspaces, attach specific documents to those
Workspaces, and chat with an AI about the attached documents.

## Core Concepts

### 1. Knowledge Base (Documents)

- A central repository of all uploaded files
- Users can upload PDFs, TXTs, DOCX files
- Files are processed, chunked, and stored in ChromaDB for AI retrieval
- Deleting a document removes it from ALL Workspaces automatically

### 2. Workspaces

- A logical container for a specific project or topic
- Workspaces do NOT own documents directly
- Users "attach" or "link" existing documents from the Knowledge Base
- A Workspace can have many Documents. A Document can be in many Workspaces
- Many-to-Many relationship via `workspace_documents` junction table

### 3. Chat Sessions (Planned)

- Users create chat sessions inside a Workspace
- AI only searches documents attached to that specific Workspace
- Full chat history saved to PostgreSQL

## Completed Features

- [x] Workspace CRUD (Create, Read, Update, Delete)
- [x] Central Knowledge Base (upload, list, delete documents)
- [x] Many-to-Many document-workspace linking (attach/detach)
- [x] File storage on disk (backend/uploaded_docs/)
- [x] Knowledge Base UI with file table
- [x] Workspace Detail UI with attach/detach
- [x] Text extraction (PDF, DOCX, TXT)
- [x] Text chunking (sliding window, smart boundaries)
- [x] Local embeddings (all-MiniLM-L6-v2, 384 dimensions)

## In Progress

- [ ] ChromaDB vector storage (Step 14)
- [ ] Retrieval logic (Step 15)
- [ ] RAG pipeline integration (Step 15)

## Pending Features

- [ ] Chat API (Step 16)
- [ ] Chat UI (Step 17)
- [ ] Chat history (Step 18)
- [ ] Streaming responses (Step 19)
- [ ] Code Generation (Steps 20-23)
- [ ] Docker Compose (Step 26)
- [ ] Final testing + documentation (Step 27)

## Important Technical Decisions

| Decision            | Choice                      | Reason                              |
| ------------------- | --------------------------- | ----------------------------------- |
| Document ownership  | Many-to-Many                | Upload once, use in many workspaces |
| Embedding model     | Local sentence-transformers | LLM API doesn't support embeddings  |
| UUID vs Integer IDs | UUID                        | Better for distributed systems      |
| File naming         | {uuid}\_{filename}          | Prevents name collisions            |
