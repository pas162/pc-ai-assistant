FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for document processing
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies with timeout for large packages
RUN pip install --no-cache-dir --timeout 300 -r requirements.txt

# Copy application code
COPY . .

# Create upload directory
RUN mkdir -p /app/uploaded_docs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application with auto-reload for development (override in production)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
