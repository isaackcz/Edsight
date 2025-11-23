#!/bin/bash
# Build script for EdSight Docker images

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[BUILD]${NC} $1"
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
BUILD_TYPE="${1:-dev}"
NO_CACHE="${2:-}"

log "Building EdSight Docker images (type: $BUILD_TYPE)"

# Set build arguments
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
VERSION="${VERSION:-1.0.0}"

BUILD_ARGS="--build-arg BUILD_DATE=$BUILD_DATE --build-arg VCS_REF=$VCS_REF --build-arg VERSION=$VERSION"

if [ "$NO_CACHE" = "--no-cache" ]; then
    BUILD_ARGS="$BUILD_ARGS --no-cache"
    log "Building without cache"
fi

# Build images
log "Building Django image..."
docker build $BUILD_ARGS -f Dockerfile.django -t edsight-django:latest .

log "Building FastAPI image..."
docker build $BUILD_ARGS -f Dockerfile.fastapi -t edsight-fastapi:latest .

log "Building Celery image..."
docker build $BUILD_ARGS -f Dockerfile.celery -t edsight-celery:latest .

log "All images built successfully!"

# Show built images
log "Built images:"
docker images | grep edsight

