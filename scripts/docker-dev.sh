#!/bin/bash
# Development Docker Helper Script for Linux/Mac
# Usage: ./scripts/docker-dev.sh [up|down|build|logs|clean]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BASE_DIR"

COMMAND="${1:-up}"

case "$COMMAND" in
    up)
        echo "Starting development environment with hot reload..."
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
        ;;
    down)
        echo "Stopping all containers..."
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down
        ;;
    build)
        echo "Building containers..."
        docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
        ;;
    logs)
        echo "Showing logs..."
        docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
        ;;
    clean)
        echo "Cleaning up containers and volumes..."
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
        docker volume prune -f
        ;;
    shell-backend)
        echo "Opening shell in backend container..."
        docker exec -it pc-ai-backend /bin/bash
        ;;
    shell-frontend)
        echo "Opening shell in frontend container..."
        docker exec -it pc-ai-frontend /bin/sh
        ;;
    *)
        echo "Usage: $0 [up|down|build|logs|clean|shell-backend|shell-frontend]"
        exit 1
        ;;
esac
