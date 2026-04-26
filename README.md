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

## � Development Mode (Hot Reload)

For development with automatic code reloading:

### Windows (PowerShell)
```powershell
.\scripts\docker-dev.ps1 up
```

### Linux/Mac
```bash
./scripts/docker-dev.sh up
```

This mounts your local source code into containers:
- **Backend:** Python code changes trigger auto-reload
- **Frontend:** Vite dev server with HMR (Hot Module Replacement)

### Development Commands

| Command | Windows | Linux/Mac |
|---------|---------|-----------|
| Start | ` .\scripts\docker-dev.ps1 up` | `./scripts/docker-dev.sh up` |
| Stop | ` .\scripts\docker-dev.ps1 down` | `./scripts/docker-dev.sh down` |
| Rebuild | ` .\scripts\docker-dev.ps1 build` | `./scripts/docker-dev.sh build` |
| Logs | ` .\scripts\docker-dev.ps1 logs` | `./scripts/docker-dev.sh logs` |
| Clean all | ` .\scripts\docker-dev.ps1 clean` | `./scripts/docker-dev.sh clean` |
| Backend shell | ` .\scripts\docker-dev.ps1 shell-backend` | `./scripts/docker-dev.sh shell-backend` |
| Frontend shell | ` .\scripts\docker-dev.ps1 shell-frontend` | `./scripts/docker-dev.sh shell-frontend` |

---

## �🛠️ Manual Setup (For Developers)

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

````
pc-ai-assistant/
├── backend/          # Python FastAPI backend
├── frontend/         # React + TypeScript frontend
├── docs/             # Architecture and requirements docs
├── docker-compose.yml
├── .env.example      # Copy this to .env
└── README.md
```
````
