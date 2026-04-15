from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.llm_client import test_llm_connection
from app.routes import workspaces
from app.routes import documents
from app.routes import chat
from app.routes import chat_sessions
from app.routes import models
from app.routes import settings
from app.routes import folders
from app.core.database import get_db_direct
from app.core.seed_settings import seed_default_settings

# Get our settings
config = get_settings()

# Create the FastAPI application
app = FastAPI(
    title="PC-AI-Assistant",
    description="Internal AI platform for knowledge management",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],    # allows GET, POST, PUT, DELETE, OPTIONS, etc.
    allow_headers=["*"],
)

app.include_router(workspaces.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(chat_sessions.router)
app.include_router(models.router, prefix="/models", tags=["models"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(folders.router)

@app.on_event("startup")
def on_startup():
    """
    Runs once when the FastAPI server starts.
    Seeds default settings into the DB if they don't exist yet.
    """
    db = get_db_direct()
    try:
        seed_default_settings(db)
    finally:
        db.close()

@app.get("/health")
def health_check():
    """
    A simple endpoint to check if the server is running.
    Like a ping endpoint in Spring Boot.
    """
    return {
        "status": "ok",
        "message": "PC-AI-Assistant is running"
    }

@app.get("/test-llm")
def test_llm():
    """
    Test endpoint to verify LLM API connection.
    Visit http://127.0.0.1:8000/test-llm to test.
    """
    return test_llm_connection()