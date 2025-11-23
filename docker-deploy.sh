#!/bin/bash
# Deployment script for EdSight Docker containers

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Parse arguments
ENV_FILE="${1:-.env.production}"
DEPLOY_TYPE="${2:-production}"

log "Deploying EdSight (type: $DEPLOY_TYPE)"

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    error "Environment file not found: $ENV_FILE"
    error "Please create it from .env.production.example"
    exit 1
fi

# Build images first
log "Building images..."
bash docker-build.sh "$DEPLOY_TYPE"

# Stop existing containers
log "Stopping existing containers..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Start services
if [ "$DEPLOY_TYPE" = "production" ]; then
    log "Starting production services..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d
else
    log "Starting development services..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
fi

# Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 10

# Check service status
log "Service status:"
docker-compose ps

# Run health checks
log "Running health checks..."
if [ -f "scripts/health-check.sh" ]; then
    bash scripts/health-check.sh
else
    warn "Health check script not found, skipping..."
fi

log "Deployment complete!"

