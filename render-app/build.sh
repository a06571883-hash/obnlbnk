#!/bin/bash

echo "Starting build process..."

# Устанавливаем глобально необходимые зависимости
echo "Installing global dependencies..."
npm install -g vite esbuild typescript

# Устанавливаем зависимости проекта
echo "Installing project dependencies..."
npm install

# Создаем директорию для сборки
echo "Creating build directory..."
mkdir -p dist/public

# Сборка клиента
echo "Building client..."
npx vite build --outDir=dist/public

# Сборка сервера
echo "Building server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Копируем необходимые файлы для запуска
echo "Copying required files..."
cp start.sh dist/
chmod +x dist/start.sh

# Создаем директории для данных
echo "Creating data directories..."
mkdir -p dist/data
mkdir -p dist/data/backup

echo "Build process completed successfully!"