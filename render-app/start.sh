#!/bin/bash

echo "Starting server in production mode..."
echo "NODE_ENV: $NODE_ENV"
echo "RENDER: $RENDER"
echo "RENDER_EXTERNAL_URL: $RENDER_EXTERNAL_URL"

# Если мы на Render, используем RENDER_EXTERNAL_URL для WEBAPP_URL
if [ -n "$RENDER" ] && [ -n "$RENDER_EXTERNAL_URL" ]; then
  export WEBAPP_URL="$RENDER_EXTERNAL_URL"
  echo "Setting WEBAPP_URL to $WEBAPP_URL from RENDER_EXTERNAL_URL"
  
  # Подготавливаем директории для данных
  echo "Preparing data directories..."
  node prepare-data.js
  
  # Настраиваем Telegram webhook
  echo "Setting up Telegram webhook..."
  node setup-telegram.js
fi

# Запускаем сервер
echo "Starting application server..."
node dist/index.js