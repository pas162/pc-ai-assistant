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
- Processing happens in the background — progress is shown live (0–100%)
- Deleting a document removes it from ALL Workspaces automatically
- Deleting a processing document cancels the background task

### 2. Workspaces

- A logical container for a specific project or topic
- Workspaces do NOT own documents directly
- Users "attach" or "link" existing documents from the Knowledge Base
- A document must be fully processed (status = "completed") before attaching
- Attaching is instant — embeddings are loaded from cache, not recalculated
- A Workspace can have many Documents. A Document can be in many Workspaces
- Many-to-Many relationship via `workspace_documents` junction table

### 3. Chat Sessions

- Users create chat sessions inside a Workspace
- AI only searches documents attached to that specific Workspace
- Full chat history saved to PostgreSQL (`chat_sessions`, `chat_messages`)
- Each message has a role: "user" or "assistant"
- History is sent to LLM on every message for conversation continuity

## Completed Features

- [x] Workspace CRUD (Create, Read, Update, Delete)
- [x] Central Knowledge Base (upload, list, delete documents)
- [x] Many-to-Many document-workspace linking (attach/detach)
- [x] File storage on disk (backend/uploaded_docs/)
- [x] Knowledge Base UI with file table
- [x] Workspace Detail UI with attach/detach
- [x] Chat API with history (sessions, messages, RAG)
- [x] Chat UI (sessions list, message bubbles, history)
- [x] Streaming responses via SSE
- [x] Text extraction (PDF, DOCX, TXT)
- [x] Text chunking (sliding window, smart boundaries)
- [x] Local embeddings (all-MiniLM-L6-v2, 384 dimensions)
- [x] ChromaDB vector storage
- [x] RAG pipeline integration + retrieval logic
- [x] Delete chat session (backend + frontend)
- [x] Status badge colors by document status
- [x] Top navbar with breadcrumb navigation
- [x] Workspace detail tabs (Chat | Documents)
- [x] Full dark mode UI (night mode only)
- [x] Collapsible sidebar
- [x] Collapsible chat sessions list
- [x] Toast notifications replacing all alert() popups
- [x] Lucide-react icons replacing all emoji icons
- [x] Upload progress bar (file transfer)
- [x] Processing progress bar (embedding generation, live polling)
- [x] Cancel document processing
- [x] Block attach until document is fully processed
- [x] Instant attach using cached embeddings (.pkl file)
- [x] Background processing pipeline (document_processor.py)

## In Progress

- None

## Pending Features

- [ ] Code Generation API (Step 19)
- [ ] Code Generation UI (Step 20)
- [ ] Code execution sandbox (Step 21)
- [ ] Code history (Step 22)
- [ ] Docker Compose (Step 25)
- [ ] Final testing + documentation (Step 26)

## Important Technical Decisions

| Decision            | Choice                      | Reason                                        |
| ------------------- | --------------------------- | --------------------------------------------- |
| Document ownership  | Many-to-Many                | Upload once, use in many workspaces           |
| Embedding model     | Local sentence-transformers | LLM API doesn't support embeddings            |
| UUID vs Integer IDs | UUID                        | Better for distributed systems                |
| File naming         | {uuid}\_{filename}          | Prevents name collisions                      |
| Chat persistence    | PostgreSQL                  | Full history replay to LLM                    |
| Processing trigger  | FastAPI BackgroundTasks     | Returns upload response instantly             |
| Embedding storage   | .pkl cache file on disk     | Attach to workspace is instant, no recompute  |
| Progress tracking   | PostgreSQL progress column  | Simple polling, no WebSockets needed          |
| Icon library        | lucide-react                | Consistent SVG icons, no emoji rendering bugs |
