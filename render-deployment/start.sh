#!/bin/bash
echo "=== Запуск приложения на Render.com ==="

# Установка переменных окружения
export NODE_ENV=production
export PORT=${PORT:-10000}

# Проверка и создание директории для данных
if [ ! -d "data" ]; then
  mkdir -p data
  mkdir -p data/backup
fi

# Запуск приложения
echo "=== Запуск Node.js приложения ==="
node dist/index.js