# PC-AI-Assistant

An internal AI platform for workspace-based knowledge management,
Chat Q&A, and Script/Code Generation.

## What It Does
- Create workspaces and upload documents
- Ask questions about your documents (Chat Q&A)
- Generate scripts and code using AI
- Powered by internal LLM API

## Tech Stack
- **Backend:** Python + FastAPI
- **Database:** PostgreSQL + ChromaDB
- **Frontend:** React + TypeScript
- **Infrastructure:** Docker

## How To Run (Development)

### 1. Start the Database
```bash
docker start pc-ai-postgres
```

### 2. Start the Backend
```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

### 3. Start the Frontend
```bash
cd frontend
npm run dev
```

## Environment Setup
Copy `.env.example` to `.env` and fill in your values.