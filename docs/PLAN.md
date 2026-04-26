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
- [x] Step 25: Docker Compose (run everything together) ✅ COMPLETE
- [ ] Step 26: Final testing + documentation

---

## Workflow Automation Phase (New)

### Overview
Extending PC-AI-Assistant to automate two critical team workflows:
1. **PIN Database Generation** — Convert PDF User Manuals + Excel files → XML pin databases for Renesas Smart Configurator
2. **SWTBot Test Script Generation** — Convert Jira/Zephyr tickets → SWTBot Java automation scripts for e² studio

### Why Extend vs New Tool
- Reuse existing document processing (PDF/Excel extraction already works)
- Reuse LLM integration (configurable API keys in Settings)
- Workspace isolation for different chip families
- Interactive chat for refinement (better than batch jobs)

---

### Sprint 7 — PIN Database Workflow (Steps 27-32)

Goal: Automate the VBA/XSLM → Python + LLM pipeline for pin database generation.

**Current Manual Process:**
1. Receive PDF (User Manual) + Excel (PIN definitions)
2. Convert XLSX → XSLM, run VBA macro to generate XML
3. Copy XML to source code, build, test with RCPTT
4. Verify each pin function matches Excel

**Automated Workflow:**

- [ ] Step 27: Multi-sheet Excel parser for PIN definitions
  - Parse multiple sheets (GPIO, SCIF, SPI, etc.)
  - Extract: Pin name, function, direction, electrical specs
  - Handle merged cells, headers, footnotes

- [ ] Step 28: PIN Database Agent backend
  - `workflows/pin_database_agent.py` module
  - LLM prompt: cross-reference PDF UM + Excel data
  - Output structured PIN definitions (JSON intermediate)

- [ ] Step 29: XML Generation with Jinja2 templates
  - `templates/pins_gpio.xml.j2`, `pins_scif.xml.j2`
  - Schema validation against Renesas XSD
  - Multiple output files per chip family

- [ ] Step 30: PIN Database Workflow UI
  - New "Workflows" section in sidebar
  - Upload: PDF (UM) + Excel (PIN data)
  - Chip family selector (RZ/G3E, RZ/G2L, etc.)
  - Generate button + progress indicator

- [ ] Step 31: Validation integration
  - Schema validation results display
  - Diff view: generated vs expected (if reference provided)
  - Download all XML files as ZIP

- [ ] Step 32: PIN Database workspace type
  - Specialized workspace for chip projects
  - Pre-configured templates per chip family
  - Store generated outputs in workspace folder

---

### Sprint 8 — SWTBot Script Generation (Steps 33-38)

Goal: Automate Jira/Zephyr ticket → SWTBot Java code generation.

**Current Manual Process:**
1. Open Jira, read Zephyr test case manually
2. Write SWTBot Java code by hand
3. Test in e² studio, iterate

**Automated Workflow:**

- [ ] Step 33: Jira API integration
  - Settings: Jira base URL + API token
  - `services/jira_client.py` — fetch ticket by ID
  - Parse: Test name, description, steps, expected results

- [ ] Step 34: SWTBot Agent backend
  - `workflows/swtbot_agent.py` module
  - LLM prompt: generate SWTBot Java from test case
  - Context: e² studio plugin conventions, Renesas-specific dialogs

- [ ] Step 35: SWTBot template library
  - Common patterns: open perspective, create project, configure build
  - Widget-specific helpers: button clicks, text input, tree navigation
  - Assertion templates: verify labels, check console output

- [ ] Step 36: SWTBot Workflow UI
  - Jira ticket ID input with fetch button
  - Display fetched test case (read-only preview)
  - Generate button → code preview with syntax highlighting
  - Copy to clipboard + download as .java file

- [ ] Step 37: Test case refinement chat
  - After generation, start chat session with SWTBot context
  - "Add error handling for this step"
  - "Change button click to menu selection"
  - Iterate without re-fetching from Jira

- [ ] Step 38: SWTBot workspace type
  - Link multiple Jira tickets to one workspace
  - Batch generate all test scripts
  - Export as Eclipse project fragment

---

### Sprint 9 — Pipeline Execution & CI/CD (Steps 39-44)

- [ ] Step 39: Workflow executor engine
  - `workflows/executor.py` — run workflows step-by-step
  - Progress tracking per step (0-100%)
  - Pause/resume/cancel support

- [ ] Step 40: Validation automation
  - RCPTT runner integration (if CLI available)
  - Parse RCPTT XML results, display in UI
  - Failures linked back to source (PDF page, Excel row)

- [ ] Step 41: Workflow history & versioning
  - Store each workflow run in database
  - Compare outputs across versions
  - Rollback to previous generation

- [ ] Step 42: Batch operations
  - Upload multiple PDF+Excel pairs
  - Queue for overnight processing
  - Email/notification on completion

- [ ] Step 43: Export & delivery
  - ZIP export with generated files + manifest
  - Git commit integration (auto-commit to branch)
  - PR creation with generated changes

- [ ] Step 44: Workflow analytics
  - Success/failure rates per workflow type
  - LLM token usage tracking
  - Time saved vs manual process metrics

---

### Sprint 10 — Enterprise Features (Steps 45-50)

- [ ] Step 45: Multi-user collaboration
  - Share workspaces between team members
  - Comments on generated outputs
  - Approval workflow before using generated XML

- [ ] Step 46: Audit logging
  - Log all LLM calls (prompt + response)
  - Log all document access
  - Compliance reporting

- [ ] Step 47: Custom workflow builder
  - UI for creating new workflow types
  - Drag-and-drop steps: upload, parse, generate, validate
  - Save custom workflows as templates

- [ ] Step 48: Integration with existing tools
  - Renesas Smart Configurator CLI (if available)
  - e² studio headless mode for test execution
  - Jenkins/GitLab CI webhook triggers

- [ ] Step 49: Advanced LLM features
  - Few-shot examples per chip family
  - Fine-tuned model on team-specific patterns
  - Multi-model comparison (run with 2 LLMs, pick best)

- [ ] Step 50: Deployment & training
  - Team onboarding documentation
  - Video tutorials for each workflow
  - Feedback collection & improvement loop

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

### Markdown Rendering Fix (Completed outside sprint plan) ✅ COMPLETE

- [x] Identified root cause — Tailwind CSS v4 ignores tailwind.config.js plugins
- [x] Fixed @tailwindcss/typography by registering via @plugin in index.css
- [x] Confirmed LLM was already outputting correct Markdown via debug logging
- [x] Strengthened FORMATTING_RULES system prompt — explicit bullet/list syntax rules
- [x] Removed debug logging from chat_sessions.py after fix confirmed

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

### UI & UX Improvements (Completed outside sprint plan) ✅ COMPLETE

- [x] Fixed stale workspace data after reload — re-fetches fresh workspace from API on restore
- [x] Fixed workspace deleted externally — clears localStorage if workspace no longer exists
- [x] Knowledge Base header redesigned — Database icon, stats bar (file count, folder count)
- [x] Knowledge Base loading skeleton — animated placeholder rows instead of plain text
- [x] Knowledge Base empty state — helpful message with direct upload button
- [x] Knowledge Base upload buttons replaced with single Upload dropdown button
- [x] Upload dropdown uses React state (not CSS hover) with click-outside-to-close
- [x] Chevron rotates 180° when upload dropdown is open
- [x] Processing indicator in stats bar (pulsing blue dot when docs are processing)

### Navigation & Layout Refactor (Completed outside sprint plan) ✅ COMPLETE

- [x] Replaced icon-rail + overlay drawer pattern with a persistent left sidebar (Linear/Notion-style)
- [x] Sidebar shows workspaces as a collapsible tree; active workspace expands inline with its chat sessions
- [x] Session list rendered inside sidebar — no more overlay, no resizable split between sessions and chat
- [x] Chat panel is always full-width — no panel resizing to fight with
- [x] Knowledge Base and Settings navigation moved to bottom of sidebar (always visible)
- [x] Removed ActivityBar (icon rail) — sidebar replaces it entirely
- [x] Removed react-resizable-panels from navigation layer (App.tsx / ChatPanel.tsx)
- [x] Session management lifted from ChatPanel → WorkspaceDetail → App (via onSessionsUpdate callback + ref)
- [x] Sidebar receives real session handlers via sessionActionsRef — new/select/delete session all work
- [x] window.confirm replaced with ConfirmModal throughout (WorkspaceDetail, WorkspaceList, SessionsSidebar)
- [x] Workspaces flyout auto-closes when a workspace is selected

### Settings UI Redesign (Completed outside sprint plan) ✅ COMPLETE

- [x] Replaced four isolated save-per-field cards with grouped sections (LLM Provider / Jira Integration)
- [x] Each group has a single "Save changes" button in the group header
- [x] Dirty-state tracking — button is blue when unsaved changes exist, shows "Saved" with green check otherwise
- [x] All fields in a group saved in parallel (Promise.all) on one click or Enter key
- [x] Inline label + description layout (label column left, input right) — cleaner scan
- [x] Monospace font for credential inputs
- [x] Group icons (Bot for LLM, Trello for Jira) with rounded tile style
