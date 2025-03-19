#!/bin/bash
echo "=== Начало процесса сборки ==="

# Создание директорий
mkdir -p dist
mkdir -p dist/public

# Установка зависимостей
npm ci --quiet

# Настройка вида директории
echo "=== Содержимое директории ==="
ls -la

# Установка глобальных инструментов для сборки
echo "=== Установка глобальных инструментов ==="
npm install -g vite@latest
npm install -g esbuild@latest
npm install -g typescript@latest

# Проверка установки инструментов
echo "=== Проверка установки инструментов ==="
vite --version || echo "Vite не установлен"
esbuild --version || echo "ESBuild не установлен"
tsc --version || echo "TypeScript не установлен"

# Сборка клиентской части через npx
echo "=== Сборка клиентской части ==="
npx vite build 

# Сборка серверной части через npx
echo "=== Сборка серверной части ==="
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Проверка результатов сборки
echo "=== Проверка результатов сборки ==="
ls -la dist
ls -la dist/public || echo "Директория dist/public не создана"

echo "=== Сборка завершена ==="