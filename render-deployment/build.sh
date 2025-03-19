#!/bin/bash
# Скрипт сборки для Render.com

echo "=== Начало процесса сборки ==="

# Установка зависимостей с игнорированием проблем с peer dependencies
npm install --legacy-peer-deps

# Установка конкретных версий необходимых пакетов
npm install --save-dev --legacy-peer-deps \
  vite@latest \
  @vitejs/plugin-react@latest \
  esbuild@latest \
  @babel/core@^7.22.0 \
  @babel/preset-env@latest \
  @babel/preset-react@latest \
  @babel/plugin-transform-runtime@latest \
  @types/node@latest

# Создание оптимизированного babel конфига
echo '{
  "presets": [
    ["@babel/preset-env", {
      "targets": {
        "node": "current"
      }
    }],
    "@babel/preset-react"
  ],
  "plugins": [
    "@babel/plugin-transform-runtime"
  ]
}' > .babelrc

echo "=== Начало сборки проекта ==="

# Сборка клиентской части
echo "Сборка клиентской части..."
node ./node_modules/vite/bin/vite.js build

# Сборка серверной части
echo "Сборка серверной части..."
node ./node_modules/esbuild/bin/esbuild server/index.ts \
  --platform=node \
  --target=node16 \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist

echo "=== Сборка успешно завершена ==="