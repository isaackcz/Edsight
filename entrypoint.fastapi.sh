#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Wait for database to be ready
wait_for_db() {
    log "Waiting for database to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.db import connection
connection.ensure_connection()
" 2>/dev/null; then
            log "Database is ready!"
            return 0
        fi
        warn "Database not ready yet. Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    error "Database connection failed after $max_attempts attempts"
    return 1
}

# Wait for Django to be ready (if needed)
wait_for_django() {
    if [ -n "${DJANGO_HOST:-}" ]; then
        log "Waiting for Django service to be ready..."
        local max_attempts=30
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if curl -f -s "http://${DJANGO_HOST}:8000/" > /dev/null 2>&1; then
                log "Django service is ready!"
                return 0
            fi
            warn "Django service not ready yet. Attempt $attempt/$max_attempts..."
            sleep 2
            attempt=$((attempt + 1))
        done
        
        warn "Django service check failed, but continuing..."
    fi
    return 0
}

# Main execution
main() {
    log "Starting FastAPI application..."
    
    # Wait for dependencies
    wait_for_db || exit 1
    wait_for_django || true
    
    log "Starting Uvicorn server..."
    exec uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port 9000 \
        --workers ${UVICORN_WORKERS:-1} \
        --log-level ${LOG_LEVEL:-info} \
        --access-log \
        --proxy-headers \
        --forwarded-allow-ips='*'
}

# Run main function
main "$@"

