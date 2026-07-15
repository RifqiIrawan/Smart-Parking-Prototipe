#!/bin/bash
# Smart Parking - Database Migration Script

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-smart_parking}
DB_USER=${DB_USER:-postgres}

echo "🚀 Running Smart Parking DB Migration..."
echo "   Host: $DB_HOST:$DB_PORT"
echo "   DB  : $DB_NAME"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f schema.sql

echo "✅ Migration complete!"
