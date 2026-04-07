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

- [x] Step 7: Workspace CRUD API + UI (Create, Read, Update, Delete)
- [x] Step 8: Document upload API (Central Knowledge Base)
- [x] Step 9: Knowledge Base UI (upload, list, delete)
- [x] Step 10: Workspace Detail UI (attach/detach documents)

### Sprint 3 — RAG Pipeline (Steps 11-15) 🔄 IN PROGRESS

- [x] Step 11: Text extraction (PDF, DOCX, TXT)
- [x] Step 12: Text chunking (sliding window algorithm)
- [x] Step 13: Local embeddings (sentence-transformers)
- [ ] Step 14: ChromaDB vector storage ← CURRENT
- [ ] Step 15: RAG pipeline integration + retrieval logic

### Sprint 4 — Chat Feature (Steps 16-19)

- [ ] Step 16: Chat API
- [ ] Step 17: Chat UI
- [ ] Step 18: Chat history
- [ ] Step 19: Streaming responses

### Sprint 5 — Code Generation (Steps 20-23)

- [ ] Step 20: Code generation API
- [ ] Step 21: Code generation UI
- [ ] Step 22: Code execution sandbox
- [ ] Step 23: Code history

### Sprint 6 — Polish (Steps 24-27)

- [ ] Step 24: Settings UI (API token management)
- [ ] Step 25: Error handling + logging
- [ ] Step 26: Docker Compose (run everything together)
- [ ] Step 27: Final testing + documentation
