#!/usr/bin/env bash
# Скрипт запуска для Render.com

# Восстановление базы данных, если она существует в директории данных
echo "Checking for database backup..."
if [ -f "./data/sqlite.db" ]; then
  echo "Restoring database from backup..."
  cp ./data/sqlite.db ./sqlite.db
  echo "Database restored successfully"
fi

# Запуск приложения
echo "Starting application..."
NODE_ENV=production node dist/index.js