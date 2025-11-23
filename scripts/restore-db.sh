#!/bin/bash
# Database restore script for EdSight

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "WARNING: This will restore the database from backup."
echo "This will overwrite all existing data!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Starting database restore from $BACKUP_FILE..."

# Decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing backup file..."
    gunzip -c "$BACKUP_FILE" | docker exec -i edsight_mysql mysql \
        -u root \
        -p"${MYSQL_ROOT_PASSWORD:-edsight_root}" \
        edsight
else
    docker exec -i edsight_mysql mysql \
        -u root \
        -p"${MYSQL_ROOT_PASSWORD:-edsight_root}" \
        edsight < "$BACKUP_FILE"
fi

echo "Database restore completed!"

