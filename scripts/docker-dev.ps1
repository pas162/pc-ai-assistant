# Development Docker Helper Script for Windows PowerShell
# Usage: .\scripts\docker-dev.ps1 [up|down|build|logs|clean]

param(
    [Parameter(Position=0)]
    [ValidateSet("up", "down", "build", "logs", "clean", "shell-backend", "shell-frontend")]
    [string]$Command = "up"
)

$BaseDir = Split-Path $PSScriptRoot -Parent
Set-Location $BaseDir

switch ($Command) {
    "up" {
        Write-Host "Starting development environment with hot reload..." -ForegroundColor Green
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
    }
    "down" {
        Write-Host "Stopping all containers..." -ForegroundColor Yellow
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down
    }
    "build" {
        Write-Host "Building containers..." -ForegroundColor Green
        docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
    }
    "logs" {
        Write-Host "Showing logs..." -ForegroundColor Cyan
        docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
    }
    "clean" {
        Write-Host "Cleaning up containers and volumes..." -ForegroundColor Red
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
        docker volume prune -f
    }
    "shell-backend" {
        Write-Host "Opening shell in backend container..." -ForegroundColor Cyan
        docker exec -it pc-ai-backend /bin/bash
    }
    "shell-frontend" {
        Write-Host "Opening shell in frontend container..." -ForegroundColor Cyan
        docker exec -it pc-ai-frontend /bin/sh
    }
}
