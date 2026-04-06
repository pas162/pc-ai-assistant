# PC-AI-Assistant: Product Requirements

## Overview
An internal AI platform that allows users to upload documents to a central Knowledge Base, create Workspaces, attach specific documents to those Workspaces, and chat with an AI about the attached documents.

## Core Concepts

### 1. Knowledge Base (Documents)
- A central repository of all uploaded files.
- Users can upload PDFs, TXTs, DOCX, etc.
- Files are processed, chunked, and stored in ChromaDB for AI retrieval.
- Deleting a document here removes it from all Workspaces.

### 2. Workspaces
- A logical container for a specific project or topic (e.g., "HR Policies 2026").
- Workspaces do NOT own documents directly.
- Users "attach" or "link" existing documents from the Knowledge Base to a Workspace.
- A Workspace can have many Documents. A Document can be in many Workspaces.

### 3. Chat Sessions
- Users create chat sessions inside a Workspace.
- When the user asks a question, the AI *only* searches the documents attached to that specific Workspace.

## Completed Features
- [x] Workspace CRUD (Create, Read, Update, Delete)
- [x] Central Knowledge Base (upload, list, delete documents)
- [x] Many-to-Many document-workspace linking
- [x] File storage on disk (`backend/uploaded_docs/`)

## Pending Features
- [ ] RAG Pipeline (text extraction, chunking, embedding, vector storage)
- [ ] Chat Q&A
- [ ] Code Generation
