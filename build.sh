#!/usr/bin/env bash
# Скрипт сборки для Render.com

# Установка зависимостей
echo "Installing dependencies..."
npm install

# Сборка проекта
echo "Building project..."
npm run build

# Создание директории для данных
echo "Creating data directory..."
mkdir -p ./data

# Резервное копирование базы данных (если существует)
echo "Backing up database..."
if [ -f "sqlite.db" ]; then
  cp sqlite.db ./data/
  echo "Database backed up successfully"
else
  echo "Database file not found, creating empty database directory"
fi