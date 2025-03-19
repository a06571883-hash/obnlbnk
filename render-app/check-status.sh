#!/bin/bash

# Скрипт для проверки статуса приложения на Render.com

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Проверяем переменные окружения
echo -e "${BLUE}Проверка переменных окружения:${NC}"

# Проверяем RENDER_EXTERNAL_URL
if [ -z "$RENDER_EXTERNAL_URL" ]; then
  echo -e "${RED}❌ RENDER_EXTERNAL_URL не задан${NC}"
else
  echo -e "${GREEN}✅ RENDER_EXTERNAL_URL: $RENDER_EXTERNAL_URL${NC}"
  BASE_URL=$RENDER_EXTERNAL_URL
fi

# Проверяем TELEGRAM_BOT_TOKEN
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo -e "${RED}❌ TELEGRAM_BOT_TOKEN не задан${NC}"
else
  echo -e "${GREEN}✅ TELEGRAM_BOT_TOKEN: установлен${NC}"
fi

# Проверяем NODE_ENV
if [ "$NODE_ENV" == "production" ]; then
  echo -e "${GREEN}✅ NODE_ENV: production${NC}"
else
  echo -e "${YELLOW}⚠️ NODE_ENV: $NODE_ENV (рекомендуется production)${NC}"
fi

# Проверяем RENDER
if [ "$RENDER" == "true" ]; then
  echo -e "${GREEN}✅ RENDER: true${NC}"
else
  echo -e "${YELLOW}⚠️ RENDER: $RENDER (рекомендуется true)${NC}"
fi

echo ""
echo -e "${BLUE}Проверка файловой системы:${NC}"

# Проверяем доступность директории /data
if [ -d "/data" ]; then
  echo -e "${GREEN}✅ Директория /data существует${NC}"
  
  # Проверяем права на запись
  if [ -w "/data" ]; then
    echo -e "${GREEN}✅ Директория /data доступна для записи${NC}"
  else
    echo -e "${RED}❌ Директория /data недоступна для записи${NC}"
  fi
  
  # Проверяем наличие базы данных
  if [ -f "/data/sqlite.db" ]; then
    echo -e "${GREEN}✅ База данных найдена: /data/sqlite.db${NC}"
    
    # Проверяем размер базы данных
    DB_SIZE=$(du -h /data/sqlite.db | cut -f1)
    echo -e "${GREEN}✅ Размер базы данных: $DB_SIZE${NC}"
  else
    echo -e "${YELLOW}⚠️ База данных не найдена: /data/sqlite.db${NC}"
  fi
  
  # Проверяем наличие директорий для бэкапов
  if [ -d "/data/backup" ]; then
    echo -e "${GREEN}✅ Директория для бэкапов существует${NC}"
    
    # Проверяем наличие бэкапов
    BACKUP_COUNT=$(find /data/backup -type f | wc -l)
    echo -e "${GREEN}✅ Количество файлов бэкапов: $BACKUP_COUNT${NC}"
  else
    echo -e "${YELLOW}⚠️ Директория для бэкапов не найдена${NC}"
  fi
else
  echo -e "${RED}❌ Директория /data не существует. Необходимо создать постоянное хранилище!${NC}"
fi

echo ""
echo -e "${BLUE}Проверка статуса приложения:${NC}"

# Проверяем, работает ли приложение
if [ ! -z "$BASE_URL" ]; then
  # Проверяем главную страницу
  MAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL)
  if [ "$MAIN_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ Главная страница доступна (200 OK)${NC}"
  else
    echo -e "${RED}❌ Главная страница недоступна (HTTP $MAIN_STATUS)${NC}"
  fi
  
  # Проверяем API статуса
  API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/render-status)
  if [ "$API_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ API статуса доступно (200 OK)${NC}"
    
    # Получаем детали статуса
    STATUS_DETAILS=$(curl -s $BASE_URL/api/render-status)
    echo -e "${GREEN}✅ Детали статуса: $STATUS_DETAILS${NC}"
  else
    echo -e "${RED}❌ API статуса недоступно (HTTP $API_STATUS)${NC}"
  fi
  
  # Проверяем информацию о Telegram боте
  TG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/telegram-info)
  if [ "$TG_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ Информация о Telegram боте доступна (200 OK)${NC}"
    
    # Получаем детали о боте
    TG_DETAILS=$(curl -s $BASE_URL/api/telegram-info)
    echo -e "${GREEN}✅ Детали Telegram бота: $TG_DETAILS${NC}"
  else
    echo -e "${RED}❌ Информация о Telegram боте недоступна (HTTP $TG_STATUS)${NC}"
  fi
else
  echo -e "${RED}❌ Невозможно проверить статус приложения - RENDER_EXTERNAL_URL не задан${NC}"
fi

echo ""
echo -e "${BLUE}Рекомендации:${NC}"

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo -e "${YELLOW}⚠️ Установите TELEGRAM_BOT_TOKEN для полной функциональности Telegram бота${NC}"
fi

if [ "$NODE_ENV" != "production" ]; then
  echo -e "${YELLOW}⚠️ Установите NODE_ENV=production для оптимальной производительности${NC}"
fi

if [ "$RENDER" != "true" ]; then
  echo -e "${YELLOW}⚠️ Установите RENDER=true для корректной работы на Render.com${NC}"
fi

if [ ! -d "/data" ]; then
  echo -e "${RED}❌ Создайте постоянное хранилище (disk) в настройках Render.com с путем /data${NC}"
fi

echo ""
echo -e "${GREEN}Проверка завершена!${NC}"