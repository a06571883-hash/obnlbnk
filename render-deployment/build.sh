#!/bin/bash
# Скрипт сборки для Render.com

echo "=== Начало процесса сборки ==="

# Установка зависимостей
npm install --legacy-peer-deps
npm install --save-dev @vitejs/plugin-react vite esbuild @babel/core@^7.22.0 @babel/preset-env @babel/preset-react

# Создание конфигурации babel
echo '{
  "presets": [
    ["@babel/preset-env", {
      "targets": {
        "node": "current"
      }
    }],
    "@babel/preset-react"
  ]
}' > .babelrc

# Сборка проекта
echo "=== Сборка клиентской части ==="
npm run build

echo "=== Сборка серверной части ==="
npm exec esbuild -- server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "=== Сборка завершена ==="