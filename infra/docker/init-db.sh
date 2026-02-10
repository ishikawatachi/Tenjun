#!/bin/sh
# Database initialization script

set -e

echo "Initializing database..."

# Create data directory if it doesn't exist
mkdir -p /data

# Check if database already exists
if [ -f "$DB_PATH" ]; then
    echo "Database already exists at $DB_PATH"
    exit 0
fi

echo "Creating new database at $DB_PATH"

# Create empty database file
touch "$DB_PATH"

# Set permissions
chmod 600 "$DB_PATH"

echo "Database initialization completed successfully"
