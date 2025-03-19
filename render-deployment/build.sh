#!/bin/bash
echo "=== Начало процесса сборки ==="

# Установка зависимостей
npm ci

# Сборка клиентской части
echo "=== Сборка клиентской части ==="
npm run build

# Сборка серверной части
echo "=== Сборка серверной части ==="
npm install -g esbuild
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "=== Сборка завершена ==="