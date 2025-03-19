#!/bin/bash

# Скрипт для подготовки проекта к деплою на Render.com

echo "Создаем архив проекта для Render.com..."

# Создаем временную директорию для архива
mkdir -p ./deploy-archive
rm -rf ./deploy-archive/*

# Копируем основные файлы проекта
echo "Копирование основных файлов проекта..."
cp -r ./client ./deploy-archive/
cp -r ./server ./deploy-archive/
cp -r ./shared ./deploy-archive/
cp ./*.json ./deploy-archive/
cp ./*.ts ./deploy-archive/
cp ./*.js ./deploy-archive/
cp ./build.sh ./deploy-archive/
cp ./start.sh ./deploy-archive/
cp ./.node-version ./deploy-archive/
cp ./.nvmrc ./deploy-archive/
cp ./render.yaml ./deploy-archive/

# Создаем архив
echo "Создание ZIP архива..."
cd ./deploy-archive
zip -r ../render-deploy.zip ./*
cd ..

echo "Архив успешно создан: render-deploy.zip"
echo "Размер архива: $(du -h render-deploy.zip | cut -f1)"

# Очищаем временную директорию
rm -rf ./deploy-archive

echo "Готово! Теперь вы можете загрузить render-deploy.zip на Render.com"