/**
 * Скрипт для подготовки директорий данных при запуске на Render.com
 * - Создает директорию data для постоянного хранилища
 * - Создает директорию data/backup для резервных копий
 * - Проверяет наличие базы данных и создает её при необходимости
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Создает необходимые директории для хранения данных
 */
function ensureDirectories() {
  const dataDir = path.join(__dirname, 'data');
  const backupDir = path.join(dataDir, 'backup');
  const sqlBackupDir = path.join(backupDir, 'sql');
  const jsonBackupDir = path.join(backupDir, 'json');
  const zipBackupDir = path.join(backupDir, 'zip');
  
  console.log('Проверяем наличие директорий для данных...');
  
  if (!fs.existsSync(dataDir)) {
    console.log(`Создаем директорию ${dataDir}...`);
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(backupDir)) {
    console.log(`Создаем директорию ${backupDir}...`);
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  if (!fs.existsSync(sqlBackupDir)) {
    console.log(`Создаем директорию ${sqlBackupDir}...`);
    fs.mkdirSync(sqlBackupDir, { recursive: true });
  }
  
  if (!fs.existsSync(jsonBackupDir)) {
    console.log(`Создаем директорию ${jsonBackupDir}...`);
    fs.mkdirSync(jsonBackupDir, { recursive: true });
  }
  
  if (!fs.existsSync(zipBackupDir)) {
    console.log(`Создаем директорию ${zipBackupDir}...`);
    fs.mkdirSync(zipBackupDir, { recursive: true });
  }
  
  console.log('Директории для данных успешно созданы или проверены.');
}

/**
 * Проверяет наличие базы данных и создает её при необходимости
 */
function checkDatabase() {
  const rootDbPath = path.join(__dirname, 'sqlite.db');
  const dataDbPath = path.join(__dirname, 'data', 'sqlite.db');
  const sessionsDbPath = path.join(__dirname, 'sessions.db');
  
  console.log('Проверяем наличие базы данных...');
  
  // Если база данных существует в основной директории, но не в data,
  // создаем копию в data
  if (fs.existsSync(rootDbPath) && !fs.existsSync(dataDbPath)) {
    console.log(`Копируем базу данных из ${rootDbPath} в ${dataDbPath}...`);
    fs.copyFileSync(rootDbPath, dataDbPath);
  }
  
  // Создаем пустой файл сессий, если он отсутствует
  if (!fs.existsSync(sessionsDbPath)) {
    console.log(`Создаем пустую базу данных сессий ${sessionsDbPath}...`);
    fs.writeFileSync(sessionsDbPath, '');
  }
  
  console.log('Проверка базы данных завершена.');
}

/**
 * Подготавливает директории и данные для Render.com
 */
function prepareForRender() {
  console.log('Начинаем подготовку данных для Render.com...');
  
  ensureDirectories();
  checkDatabase();
  
  console.log('Подготовка данных для Render.com успешно завершена!');
}

// Запускаем подготовку
prepareForRender();