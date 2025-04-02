#!/bin/bash
# Скрипт для запуска всех необходимых компонентов системы

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Запуск всех компонентов системы...${NC}"

# Остановка всех процессов Node.js
echo -e "${YELLOW}⚠️ Останавливаем все процессы Node.js...${NC}"
pkill -f "node" || true
sleep 1

# Проверка, что все процессы остановлены
NODE_PROCESSES=$(pgrep -f "node" | wc -l)
if [ "$NODE_PROCESSES" -gt 0 ]; then
  echo -e "${YELLOW}⚠️ Принудительно останавливаем оставшиеся процессы Node.js...${NC}"
  pkill -9 -f "node" || true
  sleep 1
fi

# Установка порта для NFT сервера
NFT_SERVER_PORT=8081
echo $NFT_SERVER_PORT > nft-server-port.txt
echo -e "${GREEN}✅ Установлен порт NFT сервера: ${NFT_SERVER_PORT}${NC}"

# Запуск NFT сервера в фоновом режиме
echo -e "${BLUE}🚀 Запуск NFT сервера...${NC}"
node start-nft-server.js > nft-server.log 2>&1 &
echo -e "${GREEN}✅ NFT сервер запущен в фоне (логи: nft-server.log)${NC}"

# Проверка запуска NFT сервера
sleep 2
if pgrep -f "start-nft-server.js" > /dev/null; then
  echo -e "${GREEN}✅ NFT сервер успешно запущен${NC}"
else
  echo -e "${RED}❌ Не удалось запустить NFT сервер${NC}"
fi

# Запуск основного сервера
echo -e "${BLUE}🚀 Запуск основного сервера...${NC}"
npm run dev