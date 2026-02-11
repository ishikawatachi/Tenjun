#!/bin/sh
# Database initialization script

set -e

echo "Initializing database..."

# Create data directory if it doesn't exist
mkdir -p /data

# Set default DB path if not provided
if [ -z "$DB_PATH" ]; then
    DB_PATH="/data/threat-models.db"
fi

# Check if database already exists
if [ -f "$DB_PATH" ]; then
    echo "Database already exists at $DB_PATH"
    echo "Checking schema version..."
    # Could add schema migration logic here
    exit 0
fi

echo "Creating new database at $DB_PATH"

# Create empty database file
touch "$DB_PATH"

# Set permissions
chmod 600 "$DB_PATH"

# Apply schema
SCHEMA_FILE="/app/api/src/database/schema.sql"

if [ -f "$SCHEMA_FILE" ]; then
    echo "Applying database schema from $SCHEMA_FILE"
    
    # Check if sqlite3 is available
    if command -v sqlite3 > /dev/null 2>&1; then
        sqlite3 "$DB_PATH" < "$SCHEMA_FILE"
        echo "✅ Schema applied successfully"
    else
        echo "⚠️  Warning: sqlite3 command not found. Schema not applied."
        echo "   The application will create tables on first run."
    fi
else
    echo "⚠️  Warning: Schema file not found at $SCHEMA_FILE"
    echo "   The application will create tables on first run."
fi

# Record migration
if command -v sqlite3 > /dev/null 2>&1; then
    echo "INSERT INTO migrations (name) VALUES ('initial_schema');" | sqlite3 "$DB_PATH" || true
fi

echo "Database initialization completed successfully"

