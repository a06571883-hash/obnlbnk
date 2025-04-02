#!/bin/bash
# Скрипт для запуска сервера в среде Replit
# Использует TypeScript для запуска server-replit.ts с настройками для Replit

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Запуск приложения в среде Replit...${NC}"

# Проверка доступности команд
command -v node >/dev/null 2>&1 || { 
  echo -e "${RED}❌ Node.js не установлен${NC}"; 
  exit 1; 
}
command -v npx >/dev/null 2>&1 || { 
  echo -e "${RED}❌ npx не установлен${NC}"; 
  exit 1; 
}

# Проверка наличия переменных окружения PostgreSQL
if [[ -z "$DATABASE_URL" ]]; then
  echo -e "${YELLOW}⚠️ Переменная окружения DATABASE_URL не установлена${NC}"
  echo -e "${YELLOW}⚠️ База данных может не работать корректно${NC}"
else
  echo -e "${GREEN}✅ Переменная окружения DATABASE_URL установлена${NC}"
fi

# Установка порта для NFT сервера
NFT_SERVER_PORT=8081
echo $NFT_SERVER_PORT > nft-server-port.txt
echo -e "${GREEN}✅ Установлен порт NFT сервера: ${NFT_SERVER_PORT}${NC}"

# Компиляция TypeScript в JavaScript
echo -e "${BLUE}🔄 Компиляция TypeScript...${NC}"
npx tsc --esModuleInterop --skipLibCheck server-replit.ts

# Проверка успешности компиляции
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Ошибка компиляции TypeScript${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Компиляция TypeScript успешно завершена${NC}"

# Запуск сервера
echo -e "${BLUE}🚀 Запуск сервера...${NC}"
node server-replit.js