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

- [x] Step 23: Settings UI (API token management) ✅ COMPLETE
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
- [x] Resizable panels — sidebar and chat sessions list are draggable
- [x] Panel sizes saved to localStorage (survives page refresh)
- [x] Collapsible panels using ImperativePanelHandle (collapse to zero width)
- [x] Drag handle hidden when panel is collapsed
- [x] Combined "Workspaces" header + New button into single clickable row
- [x] Combined "Chats" header + New Chat button into single clickable row
- [x] Smaller chat session title font size (text-xs)
- [x] Custom slim scrollbar (4px pill, dark theme, horizontal + vertical)
- [x] Unified chat input area (textarea + model selector + send button in one card)
- [x] Compact chat input area (auto-resize textarea, transparent model selector)
- [x] Icon-only send/stop buttons (flat, no background)
- [x] Compact navbar (h-10, smaller icons, workspace description pill)
- [x] Compact workspace header — name + description + tabs in single row
- [x] Tab style changed to bottom-border indicator (cleaner than box tabs)
- [x] Source citations under last assistant message (document filenames)
- [x] Stop streaming button (AbortController, replaces send during generation)

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
- [x] PDF table extraction using pdfplumber (converts tables to markdown)
- [x] Smart table detection — pdfplumber only runs on pages with drawing elements (10x faster)
- [x] Page-by-page extraction progress (0% → 30%) for large PDFs
- [x] Cancel supported during extraction via ExtractionCancelled exception
- [x] File cleanup on cancel — processor deletes its own files after releasing lock
- [x] Delete endpoint skips file removal if document is still processing (avoids Windows file lock)
- [x] Safe file delete with retry logic (\_safe_remove) for completed documents
- [x] Embedding model switched to BAAI/bge-base-en-v1.5 (768d, ~400MB RAM, fast on CPU)
- [x] reset_vectors.py utility script to wipe ChromaDB + .pkl cache on model change

### Chat UX Improvements (Completed outside sprint plan) ✅ COMPLETE

- [x] Auto-title chat sessions using LLM after first message (few-shot prompt)
- [x] Manual rename by double-clicking session title (inline input)
- [x] PATCH /chat/sessions/{id} endpoint for renaming
- [x] Last active session remembered per workspace (survives workspace switching)
- [x] Tab switching (Chat ↔ Documents) preserves chat state using CSS hidden
- [x] Model selector combobox in chat input area (fetched from LLM API, per session)
- [x] RAG toggle button (per message, RAG On/Off in chat input bar)
- [x] Markdown rendering in assistant messages (react-markdown)
- [x] Syntax highlighted code blocks (react-syntax-highlighter, vscDarkPlus theme)
- [x] Code block language label + copy icon button
- [x] LLM system prompt updated with formatting rules (code blocks, tables, headers)
- [x] Improved RAG system prompt — synthesis-focused, not restrictive

### Settings & Configuration (Completed outside sprint plan) ✅ COMPLETE

- [x] Settings table in PostgreSQL (key-value store)
- [x] GET /settings and PUT /settings/{key} endpoints
- [x] Settings UI panel (accessible from navbar top-right)
- [x] LLM API token and base URL managed via Settings UI
- [x] LLM config moved from .env to database (DB takes priority, .env is fallback)
- [x] seed_settings.py seeds default values on app startup
- [x] Actionable error message when token is not configured
- [x] .env reduced to infrastructure-only (DB credentials, ports)

### Knowledge Base Folder Structure (Completed outside sprint plan) ✅ COMPLETE

- [x] folders table + Alembic migration
- [x] folder_path column on documents table + Alembic migration
- [x] POST /folders — create empty folder (validates parent exists)
- [x] GET /folders — flat list (frontend builds tree)
- [x] DELETE /folders/{id} — cascade delete nested folders + documents + vectors
- [x] Folder tree UI in KnowledgeBase.tsx (FolderTree, FolderNode, DocumentRow components)
- [x] Upload files into selected folder (per-folder upload button)
- [x] Upload folder via webkitdirectory (preserves real path structure)
- [x] Auto-create intermediate folders on folder upload
- [x] Code file types added to ALLOWED_EXTENSIONS and text_extractor.py
- [x] Filename prepended to extracted content for code files (LLM context)
- [x] os.path.basename fix — strips relative path from filename on folder upload
- [x] Bulk attach modal — folder tree with checkboxes (indeterminate state)
- [x] POST /workspaces/{id}/documents/bulk endpoint
- [x] Workspace documents tab replaced with folder tree view
- [x] Route order fix — /bulk declared before /{document_id} to prevent conflict
- [x] File type color coding in document rows (per extension)
- [x] File size display in document rows (B / KB / MB formatting)
- [x] Fixed-width columns in tree rows (type, size, status, delete aligned)
- [x] Searchable model combobox (strips databricks- prefix, search filter, checkmark)

### Chat Input Enhancements (Completed outside sprint plan) ✅ COMPLETE

- [x] File attach button (paperclip) — attach .py, .java, .xml, .txt, .json, .ts, .js, .md, .yaml, .sql, .sh files directly in chat input
- [x] File content read client-side as plain text (max 500KB per file)
- [x] Attached files sent to backend as attached_files: [{filename, content}]
- [x] @ mention dropdown refactored — mode picker (Files/Folders) shown first on @
- [x] Mention search driven by textarea input — no separate search box
- [x] Keyboard navigation for mode picker (↑↓ to highlight, Enter to select)
- [x] Mode indicator pill shown after mode selected (with clear button)
- [x] Typing after @ without selecting mode searches all types
- [x] @ mention supports both files and folders (selecting folder adds all its docs)
- [x] Mention dropdown: single flat list, keyboard nav (↑↓ Enter Esc), live search filter
- [x] Mentioned docs sent to backend as mentioned_doc_ids: [uuid, ...]
- [x] Pills shown inside chat input card (file attach = gray, mentions = blue)
- [x] Folder mention pill removes all its child docs when dismissed
- [x] ChatPanel refactored into modular files under frontend/src/components/chat/
- [x] useChatSessions hook — session CRUD, rename, load logic
- [x] useChatStream hook — streaming, send, stop, abort logic
- [x] useFileAttach hook — file attach, validation, removal
- [x] useMention hook — @ mention state, dropdown, commit logic
- [x] ChatPanel.tsx reduced to ~180 lines (pure composition)
- [x] Fixed React 19 RefObject<T | null> type compatibility in useMention + SessionsSidebar
- [x] @ mention sends mentioned_doc_ids to backend on every message
- [x] Attached files content sent to backend as attached_files on every message
- [x] Backend retrieves chunks filtered by mentioned doc (ChromaDB where filter)
- [x] Mentioned doc context injected into LLM system prompt separately
- [x] Attached file content injected into LLM system prompt
- [x] Mentioned doc pills displayed on sent user message bubble
- [x] Attached file pills displayed on sent user message bubble (persists after stream)
- [x] ChatMessageWithMeta type extends ChatMessage with mentionedDocs and attachedFiles fields
- [x] SendMessageRequest schema updated with attached_files + mentioned_doc_ids
- [x] retriever.py supports filter_doc_id via ChromaDB where filter
