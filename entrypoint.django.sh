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

# Ensure database user exists
ensure_db_user() {
    log "Ensuring database user exists..."
    python -c "
import os
try:
    import MySQLdb
    root_password = os.environ.get('MYSQL_ROOT_PASSWORD', '')
    db_name = os.environ.get('DB_NAME', 'edsight_prod')
    db_user = os.environ.get('DB_USER', 'edsight_prod')
    db_password = os.environ.get('DB_PASSWORD', '')
    db_host = os.environ.get('DB_HOST', 'mysql')
    
    if root_password:
        conn = MySQLdb.connect(host=db_host, user='root', passwd=root_password)
        cursor = conn.cursor()
        cursor.execute(f\"CREATE DATABASE IF NOT EXISTS {db_name}\")
        cursor.execute(f\"CREATE USER IF NOT EXISTS '{db_user}'@'%' IDENTIFIED BY '{db_password}'\")
        cursor.execute(f\"GRANT ALL PRIVILEGES ON {db_name}.* TO '{db_user}'@'%'\")
        cursor.execute('FLUSH PRIVILEGES')
        conn.close()
        print('Database user created/verified')
except ImportError:
    pass
except Exception as e:
    print(f'Could not create user (may already exist): {e}')
" 2>/dev/null || true
}

# Wait for database to be ready
wait_for_db() {
    log "Waiting for database to be ready..."
    local max_attempts=30
    local attempt=1
    
    # First, try to create the user using root credentials BEFORE checking connection
    log "Attempting to create database user if needed..."
    ensure_db_user
    
    while [ $attempt -le $max_attempts ]; do
        if python manage.py check --database default 2>/dev/null; then
            log "Database is ready!"
            return 0
        fi
        # Try creating user again every 5 attempts in case MySQL wasn't ready
        if [ $((attempt % 5)) -eq 0 ]; then
            ensure_db_user
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
    log "Checking Redis connection..."
    if python -c "import redis; r = redis.Redis(host='${REDIS_HOST:-redis}', port=${REDIS_PORT:-6379}, db=${REDIS_DB:-0}); r.ping()" 2>/dev/null; then
        log "Redis is ready!"
        return 0
    else
        warn "Redis connection check failed, but continuing..."
        return 0
    fi
}

# Main execution
main() {
    log "Starting Django application..."
    
    # Wait for dependencies
    wait_for_db || exit 1
    wait_for_redis || true
    
    # Apply database migrations with retry logic
    log "Applying database migrations..."
    
    # Check if database is empty (no django_migrations table)
    if ! python manage.py showmigrations 2>/dev/null | grep -q "\[X\]"; then
        log "Fresh database detected, marking migrations as applied if needed..."
        # For fresh databases, we might need to fake initial migrations
        # if the SQL file already created the tables
    fi
    
    local migration_attempts=3
    local migration_attempt=1
    
    while [ $migration_attempt -le $migration_attempts ]; do
        if python manage.py migrate --noinput --run-syncdb 2>&1 | tee /tmp/migrate.log; then
            log "Migrations applied successfully!"
            break
        else
            # Check if it's a table doesn't exist error
            if grep -q "doesn't exist" /tmp/migrate.log 2>/dev/null; then
                warn "Migration error: table doesn't exist. This may be normal for fresh database."
                warn "Trying to fake problematic migrations..."
                # Try to fake the problematic migration
                python manage.py migrate --fake core 0018 2>/dev/null || true
                # Try migrate again
                if python manage.py migrate --noinput; then
                    log "Migrations applied successfully after faking!"
                    break
                fi
            fi
            
            if [ $migration_attempt -eq $migration_attempts ]; then
                error "Failed to apply migrations after $migration_attempts attempts"
                error "You may need to manually fix migrations. Check logs above."
                # Don't exit - let the server start anyway
                warn "Continuing despite migration errors..."
                break
            fi
            warn "Migration attempt $migration_attempt failed, retrying..."
            sleep 5
            migration_attempt=$((migration_attempt + 1))
        fi
    done
    
    # Check if DEBUG mode is enabled
    if [ "${DEBUG:-False}" = "True" ] || [ "${DEBUG:-False}" = "true" ] || [ "${DEBUG:-1}" = "1" ]; then
        log "DEBUG mode detected: starting Django development server (autoreload)"
        # Don't collect static files for dev; let runserver serve from app/static
        exec python manage.py runserver 0.0.0.0:8000
    else
        log "Production mode: collecting static files..."
        # Collect static files to the shared static volume
        if python manage.py collectstatic --noinput --clear; then
            log "Static files collected successfully!"
        else
            warn "Static file collection had issues, but continuing..."
        fi
        
        log "Starting Gunicorn with ${GUNICORN_WORKERS:-3} workers..."
        exec gunicorn app.wsgi:application \
            --bind 0.0.0.0:8000 \
            --workers ${GUNICORN_WORKERS:-3} \
            --timeout 120 \
            --access-logfile - \
            --error-logfile - \
            --log-level info
    fi
}

# Run main function
main "$@"

