#!/bin/bash

# Скрипт для запуска всего приложения

echo "🌟 Запускаем NFT Marketplace (REPLIT)"
echo "🔄 Запуск NFT сервера..."

# Запускаем NFT сервер в фоновом режиме
node start-nft-server.js &
NFT_SERVER_PID=$!

# Даем время на запуск NFT сервера
echo "⏳ Ждем запуск NFT сервера..."
sleep 3

# Проверяем, запущен ли NFT сервер
if [ -f "nft-server-port.txt" ]; then
  NFT_PORT=$(cat nft-server-port.txt)
  echo "✅ NFT сервер запущен на порту $NFT_PORT"
else
  echo "⚠️ Не удалось определить порт NFT сервера, но продолжаем..."
fi

# Запускаем основной сервер
echo "🔄 Запуск основного сервера..."
exec tsx server/index.ts