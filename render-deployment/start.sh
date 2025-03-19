#!/bin/bash
echo "=== Запуск приложения на Render.com ==="

# Установка переменных окружения
export NODE_ENV=production
export PORT=${PORT:-10000}

# Проверка и создание директории для данных
if [ ! -d "data" ]; then
  echo "Создание директорий для данных..."
  mkdir -p data
  mkdir -p data/backup
fi

# Проверка результатов сборки
echo "=== Проверка наличия файлов сборки ==="
ls -la dist || echo "Директория dist не найдена"
ls -la dist/public || echo "Директория dist/public не найдена"

# Проверка наличия главного файла сервера
if [ ! -f "dist/index.js" ]; then
  echo "ОШИБКА: Файл dist/index.js не найден!"
  exit 1
fi

# Запуск приложения
echo "=== Запуск Node.js приложения ==="
node dist/index.js