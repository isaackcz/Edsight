#!/bin/bash
# Database backup script for EdSight

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/edsight_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."

# Backup MySQL database
docker exec edsight_mysql mysqldump \
    -u root \
    -p"${MYSQL_ROOT_PASSWORD:-edsight_root}" \
    --single-transaction \
    --routines \
    --triggers \
    edsight > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "Backup completed: $BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "edsight_backup_*.sql.gz" -mtime +7 -delete

echo "Old backups cleaned up (kept last 7 days)"

