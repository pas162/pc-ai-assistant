from fastapi import FastAPI
from app.core.config import get_settings
from app.core.llm_client import test_llm_connection
from app.routes import workspaces

# Get our settings
settings = get_settings()

# Create the FastAPI application
app = FastAPI(
    title="PC-AI-Assistant",
    description="Internal AI platform for knowledge management",
    version="0.1.0"
)

app.include_router(workspaces.router)

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