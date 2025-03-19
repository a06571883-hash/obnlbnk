#!/bin/bash

echo "===== ПРОВЕРКА СТАТУСА ПРИЛОЖЕНИЯ ====="
echo "Дата: $(date)"
echo "Окружение: $NODE_ENV"

echo ""
echo "=== Проверка директорий ==="
if [ -d "./data" ]; then
  echo "✅ Директория data существует"
  echo "   Размер: $(du -sh ./data | cut -f1)"
  echo "   Файлы: $(ls -la ./data | wc -l) элементов"
else
  echo "❌ Директория data не существует"
fi

if [ -d "./data/backup" ]; then
  echo "✅ Директория data/backup существует"
  echo "   Размер: $(du -sh ./data/backup | cut -f1)"
  echo "   Файлы: $(ls -la ./data/backup | wc -l) элементов"
else
  echo "❌ Директория data/backup не существует"
fi

echo ""
echo "=== Проверка файлов ==="
if [ -f "./data/sqlite.db" ]; then
  echo "✅ База данных sqlite.db существует"
  echo "   Размер: $(du -sh ./data/sqlite.db | cut -f1)"
else
  echo "❌ База данных sqlite.db не существует"
fi

if [ -f "./sessions.db" ]; then
  echo "✅ База сессий sessions.db существует"
  echo "   Размер: $(du -sh ./sessions.db | cut -f1)"
else
  echo "❌ База сессий sessions.db не существует"
fi

echo ""
echo "=== Проверка переменных окружения ==="
echo "NODE_ENV: $NODE_ENV"
echo "RENDER: $RENDER"
echo "RENDER_EXTERNAL_URL: $RENDER_EXTERNAL_URL"
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  echo "✅ TELEGRAM_BOT_TOKEN установлен"
else
  echo "❌ TELEGRAM_BOT_TOKEN отсутствует"
fi

if [ -n "$SESSION_SECRET" ]; then
  echo "✅ SESSION_SECRET установлен"
else
  echo "❌ SESSION_SECRET отсутствует"
fi

if [ -n "$WEBAPP_URL" ]; then
  echo "✅ WEBAPP_URL установлен: $WEBAPP_URL"
else
  echo "❌ WEBAPP_URL отсутствует"
fi

echo ""
echo "=== Статус приложения ==="
echo "PID текущего процесса: $$"
echo "Запущенные процессы node:"
ps aux | grep node | grep -v grep

echo ""
echo "=== Доступные порты ==="
netstat -tlpn 2>/dev/null | grep node

echo ""
echo "===== ПРОВЕРКА ЗАВЕРШЕНА ====="