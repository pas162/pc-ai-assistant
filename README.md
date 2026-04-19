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

---

## 🚀 Quick Start (One Command)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Steps

```bash
# 1. Copy environment file and fill in your values
cp .env.example .env

# 2. Start everything
docker compose up --build
```

Then open http://localhost:3000 in your browser.

To stop everything:

```bash
docker compose down
```

To stop and delete all data (full reset):

```bash
docker compose down -v
```

---

## 🛠️ Manual Setup (For Developers)

Use this if you want to run services individually for development.

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

---

## ⚙️ Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key values to set:
| Variable | Description |
|---|---|
| `POSTGRES_USER` | Your PostgreSQL username |
| `POSTGRES_PASSWORD` | Your PostgreSQL password |
| `POSTGRES_DB` | Database name (default: pc_ai_assistant) |
| `DATABASE_URL` | Full PostgreSQL connection string |
| `BACKEND_PORT` | Backend port (default: 8000) |
| `VITE_API_BASE_URL` | Backend URL for frontend (default: http://localhost:8000) |

> **LLM Settings** (API token, base URL) are configured inside the app via
> the Settings panel (gear icon, top right). No `.env` changes needed.

---

## 📁 Project Structure

`````
pc-ai-assistant/
├── backend/          # Python FastAPI backend
├── frontend/         # React + TypeScript frontend
├── docs/             # Architecture and requirements docs
├── docker-compose.yml
├── .env.example      # Copy this to .env
└── README.md
```
````

---

## 📋 Summary of New Files

```
docker-compose.yml        ← one command to start everything
backend/Dockerfile        ← builds the FastAPI backend
frontend/Dockerfile       ← builds the React frontend
README.md                 ← updated with Quick Start + manual steps
```

The key thing to note: **`docker compose up --build`** will:
1. Start PostgreSQL
2. Start ChromaDB
3. Run Alembic migrations automatically
4. Start the backend
5. Start the frontend
`````
