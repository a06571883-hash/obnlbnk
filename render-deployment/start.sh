#!/bin/bash
# Скрипт запуска для Render.com

echo "=== Запуск приложения на Render.com ==="

# Установка переменных окружения
export RENDER=true # Retained from original for Render.com
export NODE_ENV=production
export PORT=${PORT:-10000} # Added from edited script


# Проверка и создание директории для данных
if [ ! -d "data" ]; then
  echo "Создание директории data..."
  mkdir -p data
  mkdir -p data/backup
fi

# Копирование базы данных если она существует
if [ -f "data/sqlite.db" ]; then
  echo "Копирование рабочей базы данных..."
  cp data/sqlite.db sqlite.db

  # Создаем дополнительную резервную копию перед запуском (Retained from original)
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  echo "Создание резервной копии базы данных перед запуском..."
  cp data/sqlite.db "data/backup/pre_start_$TIMESTAMP.db"
  echo "Резервная копия создана в data/backup/pre_start_$TIMESTAMP.db"
else
  echo "ВНИМАНИЕ: База данных не найдена в постоянном хранилище!"
  #The rest of the else block from the original is removed as it's redundant with the simplification.
fi


echo "=== Запуск Node.js приложения ==="
node dist/index.js