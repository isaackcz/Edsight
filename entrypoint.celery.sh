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
        if python manage.py check --database default 2>/dev/null; then
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

# Wait for Redis to be ready
wait_for_redis() {
    log "Waiting for Redis to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if python -c "import redis; r = redis.Redis(host='${REDIS_HOST:-redis}', port=${REDIS_PORT:-6379}, db=${REDIS_DB:-0}); r.ping()" 2>/dev/null; then
            log "Redis is ready!"
            return 0
        fi
        warn "Redis not ready yet. Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    error "Redis connection failed after $max_attempts attempts"
    return 1
}

# Main execution
main() {
    log "Starting Celery worker..."
    
    # Wait for dependencies
    wait_for_db || exit 1
    wait_for_redis || exit 1
    
    # Determine if this is a beat scheduler or worker
    if [ "${CELERY_BEAT:-false}" = "true" ]; then
        log "Starting Celery Beat scheduler..."
        exec celery -A app beat \
            -l ${CELERY_LOG_LEVEL:-info} \
            --scheduler django_celery_beat.schedulers:DatabaseScheduler \
            --pidfile=/tmp/celerybeat.pid
    else
        log "Starting Celery worker..."
        exec celery -A app worker \
            -l ${CELERY_LOG_LEVEL:-info} \
            --concurrency=${CELERY_CONCURRENCY:-4} \
            --max-tasks-per-child=${CELERY_MAX_TASKS_PER_CHILD:-1000} \
            --time-limit=${CELERY_TIME_LIMIT:-300} \
            --soft-time-limit=${CELERY_SOFT_TIME_LIMIT:-240}
    fi
}

# Run main function
main "$@"

