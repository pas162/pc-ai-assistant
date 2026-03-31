from fastapi import FastAPI
from app.core.config import get_settings

# Get our settings
settings = get_settings()

# Create the FastAPI application
app = FastAPI(
    title="PC-AI-Assistant",
    description="Internal AI platform for knowledge management",
    version="0.1.0"
)


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