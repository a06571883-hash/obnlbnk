#!/bin/bash
echo "=== Начало процесса сборки ==="

# Установка зависимостей
npm ci

# Установка глобальных инструментов для сборки
echo "=== Установка глобальных инструментов ==="
npm install -g vite
npm install -g esbuild
npm install -g typescript

# Сборка клиентской части напрямую
echo "=== Сборка клиентской части ==="
cd client
vite build --outDir=../dist/public
cd ..

# Сборка серверной части
echo "=== Сборка серверной части ==="
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "=== Сборка завершена ==="