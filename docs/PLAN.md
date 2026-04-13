# PC-AI-Assistant — Project Plan

## What We Are Building

An internal AI platform with:

- Workspace-based knowledge bases
- Chat Q&A (ask questions about uploaded documents)
- Script/Code Generation
- Powered by internal LLM API at http://10.210.106.4:8080

## Tech Stack

- **Backend:** Python + FastAPI
- **Database:** PostgreSQL (metadata) + ChromaDB (vector/AI search)
- **Frontend:** React + TypeScript + Tailwind CSS
- **Infrastructure:** Docker

## Sprint Plan

### Sprint 1 — Foundation (Steps 1-6) ✅ COMPLETE

- [x] Step 1: Project folder structure + Git
- [x] Step 2: Backend skeleton (FastAPI)
- [x] Step 3: Database setup (PostgreSQL + models)
- [x] Step 4: Vector database setup (ChromaDB)
- [x] Step 5: LLM API connection
- [x] Step 6: Basic frontend scaffold (React)

### Sprint 2 — Workspace & Document Management (Steps 7-10) ✅ COMPLETE

- [x] Step 7: Workspace CRUD API + UI
- [x] Step 8: Document upload API (Central Knowledge Base)
- [x] Step 9: Knowledge Base UI (upload, list, delete)
- [x] Step 10: Workspace Detail UI (attach/detach documents)

### Sprint 3 — RAG Pipeline (Steps 11-15) ✅ COMPLETE

- [x] Step 11: Text extraction (PDF, DOCX, TXT)
- [x] Step 12: Text chunking (sliding window algorithm)
- [x] Step 13: Local embeddings (sentence-transformers)
- [x] Step 14: ChromaDB vector storage
- [x] Step 15: RAG pipeline integration + retrieval logic

### Sprint 4 — Chat Feature (Steps 16-18) ✅ COMPLETE

- [x] Step 16: Chat API with history (sessions + messages + RAG)
- [x] Step 17: Chat UI
- [x] Step 18: Streaming responses

### Sprint 5 — Code Generation (Steps 19-22)

- [ ] Step 19: Code generation API
- [ ] Step 20: Code generation UI
- [ ] Step 21: Code execution sandbox
- [ ] Step 22: Code history

### Sprint 6 — Polish (Steps 23-26)

- [ ] Step 23: Settings UI (API token management)
- [ ] Step 24: Error handling + logging
- [ ] Step 25: Docker Compose (run everything together)
- [ ] Step 26: Final testing + documentation

### Frontend Polish (Completed outside sprint plan) ✅ COMPLETE

- [x] Status badge colors (green/yellow/red/blue based on document status)
- [x] Top navbar with app title + current workspace breadcrumb
- [x] Sidebar polish (doc count, better buttons)
- [x] Chat UI polish (timestamps, delete session, spinner send button)
- [x] Toast notifications (replaced all alert() popups)
- [x] Workspace detail tabs (Chat tab + Documents tab)
- [x] Documents tab includes attached docs management
- [x] Full dark mode (night mode only)
- [x] Collapsible sidebar (Lucide PanelLeftClose/PanelLeftOpen icons)
- [x] Collapsible chat sessions list (toggle button)
- [x] Replaced all emoji icons with lucide-react SVG icons
- [x] Removed Workspace Settings section from Documents tab

### Background Processing & Progress Bar (Completed outside sprint plan) ✅ COMPLETE

- [x] Document processing pipeline moved to background task (FastAPI BackgroundTasks)
- [x] Upload progress bar (0–100% during file transfer)
- [x] Processing progress bar (0–100% during embedding generation)
- [x] Frontend polls every 2 seconds for live status updates
- [x] Cancel processing by deleting a pending/processing document
- [x] Embedding cache (.pkl) saved to disk so attach-to-workspace is instant
- [x] Fixed attach button — only enabled when document status is "completed"
- [x] Fixed attach bug — tracks attaching ID instead of boolean flag
- [x] ChromaDB batch insert (5000 per batch) to handle large documents

### Chat UX Improvements (Completed outside sprint plan) ✅ COMPLETE

- [x] Auto-title chat sessions using LLM after first message (few-shot prompt)
- [x] Manual rename by double-clicking session title (inline input)
- [x] PATCH /chat/sessions/{id} endpoint for renaming
- [x] Last active session remembered per workspace (survives workspace switching)
- [x] Tab switching (Chat ↔ Documents) preserves chat state using CSS hidden
- [x] Model selector combobox in chat input area (fetched from LLM API, per session)
