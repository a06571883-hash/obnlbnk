#!/bin/bash

# Запуск NFT сервера в фоновом режиме
echo "Запуск NFT сервера..."
node run-nft-server.js > logs/nft-server.log 2>&1 &
NFT_SERVER_PID=$!
echo "NFT сервер запущен с PID: $NFT_SERVER_PID"

# Небольшая пауза, чтобы NFT сервер успел запуститься
sleep 2

# Запуск основного приложения
echo "Запуск основного приложения..."
npm run dev

# При завершении скрипта, также завершаем фоновый процесс
trap "kill $NFT_SERVER_PID" EXIT