/**
 * Скрипт для подготовки директорий данных при переносе на Render.com
 * - Создает директорию data
 * - Создает директорию data/backup для резервных копий
 * - Копирует текущую базу данных sqlite.db в data/sqlite.db
 * - Создает начальную резервную копию
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Пути к важным файлам и директориям
const DATA_DIR = path.join(rootDir, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');
const DB_PATH = path.join(rootDir, 'sqlite.db');
const RENDER_DB_PATH = path.join(DATA_DIR, 'sqlite.db');

/**
 * Создает директории для хранения данных и резервных копий
 */
function createDirectories() {
  console.log('\n=== Создание директорий для хранения данных ===');
  
  // Создаем директорию data
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`Создание директории ${DATA_DIR}...`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Директория ${DATA_DIR} создана успешно`);
  } else {
    console.log(`Директория ${DATA_DIR} уже существует`);
  }
  
  // Создаем директорию backup
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log(`Создание директории ${BACKUP_DIR}...`);
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Директория ${BACKUP_DIR} создана успешно`);
  } else {
    console.log(`Директория ${BACKUP_DIR} уже существует`);
  }
}

/**
 * Копирует базу данных в директорию permanent storage
 */
function copyDatabase() {
  console.log('\n=== Копирование базы данных ===');
  
  if (!fs.existsSync(DB_PATH)) {
    console.log(`ОШИБКА: База данных ${DB_PATH} не найдена!`);
    return false;
  }
  
  try {
    // Копируем базу данных в директорию data
    fs.copyFileSync(DB_PATH, RENDER_DB_PATH);
    console.log(`База данных скопирована в ${RENDER_DB_PATH}`);
    
    // Создаем резервную копию с временной меткой
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupPath = path.join(BACKUP_DIR, `initial_backup_${timestamp}.db`);
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`Резервная копия создана в ${backupPath}`);
    
    return true;
  } catch (error) {
    console.error('Ошибка при копировании базы данных:', error);
    return false;
  }
}

/**
 * Выводит информацию о базах данных
 */
function printDatabaseInfo() {
  console.log('\n=== Информация о базах данных ===');
  
  // Проверяем основную базу данных
  if (fs.existsSync(DB_PATH)) {
    const mainDbStats = fs.statSync(DB_PATH);
    console.log(`Основная база данных (${DB_PATH}):`);
    console.log(`  - Размер: ${(mainDbStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Дата изменения: ${mainDbStats.mtime}`);
  } else {
    console.log(`Основная база данных (${DB_PATH}) не найдена!`);
  }
  
  // Проверяем копию в директории data
  if (fs.existsSync(RENDER_DB_PATH)) {
    const dataDbStats = fs.statSync(RENDER_DB_PATH);
    console.log(`База данных в директории data (${RENDER_DB_PATH}):`);
    console.log(`  - Размер: ${(dataDbStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Дата изменения: ${dataDbStats.mtime}`);
  } else {
    console.log(`База данных в директории data (${RENDER_DB_PATH}) не найдена!`);
  }
  
  // Проверяем резервные копии
  if (fs.existsSync(BACKUP_DIR)) {
    const backupFiles = fs.readdirSync(BACKUP_DIR).filter(file => file.endsWith('.db'));
    console.log(`\nРезервные копии (${BACKUP_DIR}):`);
    if (backupFiles.length === 0) {
      console.log('  Резервных копий не найдено');
    } else {
      backupFiles.forEach(file => {
        const backupPath = path.join(BACKUP_DIR, file);
        const backupStats = fs.statSync(backupPath);
        console.log(`  - ${file}:`);
        console.log(`    - Размер: ${(backupStats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    - Дата: ${backupStats.mtime}`);
      });
    }
  }
}

/**
 * Подготавливает директории и данные для Render.com
 */
function prepareForRender() {
  console.log('=== Подготовка директории данных для Render.com ===');
  
  createDirectories();
  const dbCopied = copyDatabase();
  printDatabaseInfo();
  
  console.log('\n=== Результаты подготовки ===');
  if (dbCopied) {
    console.log(`✅ Директории и данные для Render.com подготовлены успешно!`);
    console.log(`✅ База данных скопирована в ${RENDER_DB_PATH}`);
    console.log(`✅ Резервная копия создана в директории ${BACKUP_DIR}`);
  } else {
    console.log(`❌ Не удалось скопировать базу данных!`);
    console.log(`❌ Проверьте наличие файла ${DB_PATH}`);
  }
}

// Запуск подготовки
prepareForRender();