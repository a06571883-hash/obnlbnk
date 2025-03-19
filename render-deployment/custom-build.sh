#!/bin/bash

echo "=== Начало пользовательского процесса сборки ==="

# Установка зависимостей напрямую без package.json скриптов
echo "=== Установка зависимостей ==="
npm ci

# Установка глобальных инструментов для сборки
echo "=== Установка необходимых инструментов ==="
npm install -g vite@latest
npm install -g esbuild@latest
npm install -g typescript@latest

# Проверка установки инструментов
echo "=== Проверка установки инструментов ==="
vite --version
esbuild --version
tsc --version

# Создание директорий для вывода
echo "=== Подготовка директорий ==="
mkdir -p dist
mkdir -p dist/public

# Запуск vite для сборки клиентской части
echo "=== Сборка клиентской части с помощью Vite ==="
cd client
npx vite build --outDir=../dist/public
cd ..

# Сборка серверной части с помощью esbuild
echo "=== Сборка серверной части с помощью ESBuild ==="
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Проверка результатов
echo "=== Результаты сборки ==="
ls -la dist
ls -la dist/public

echo "=== Сборка завершена ==="