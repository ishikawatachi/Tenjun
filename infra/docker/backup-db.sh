#!/bin/sh
# Database backup script

set -e

BACKUP_DIR="/backups"
DB_PATH="/data/threat-model.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/threat-model_$TIMESTAMP.db"
MAX_BACKUPS=7

echo "Starting database backup at $(date)"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Database not found at $DB_PATH"
    exit 1
fi

# Create backup
echo "Creating backup: $BACKUP_FILE"
cp "$DB_PATH" "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"
echo "Backup compressed: ${BACKUP_FILE}.gz"

# Remove old backups (keep only last MAX_BACKUPS)
echo "Removing old backups (keeping last $MAX_BACKUPS)..."
cd "$BACKUP_DIR"
ls -t threat-model_*.db.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm

# Calculate backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
echo "Backup completed successfully. Size: $BACKUP_SIZE"

# List all backups
echo "Current backups:"
ls -lh threat-model_*.db.gz 2>/dev/null || echo "No backups found"

echo "Backup process completed at $(date)"
