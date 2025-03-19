import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync, copyFileSync } from 'fs';
import path from 'path';
import * as fs from 'fs';

// Используем локальную SQLite базу данных вместо Neon PostgreSQL
console.log('Using SQLite as the database (completely free and no expiration)');

// Определяем, запущено ли приложение на Render.com
const IS_RENDER = process.env.RENDER === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Пути к файлам базы данных
let DB_PATH = path.join(process.cwd(), 'sqlite.db');
const RENDER_DATA_DIR = path.join(process.cwd(), 'data');
const RENDER_DB_PATH = path.join(RENDER_DATA_DIR, 'sqlite.db');

// Для Render.com используем постоянное хранилище в /data
if (IS_RENDER && IS_PRODUCTION) {
  console.log('Running on Render.com in production mode');
  console.log('Permanent storage directory:', RENDER_DATA_DIR);
  
  // Проверяем, существует ли директория data
  if (!existsSync(RENDER_DATA_DIR)) {
    console.log('Creating data directory...');
    fs.mkdirSync(RENDER_DATA_DIR, { recursive: true });
  }
  
  // Проверяем, существует ли база данных в постоянном хранилище
  if (existsSync(RENDER_DB_PATH)) {
    console.log('Found database in permanent storage, copying to working directory...');
    try {
      copyFileSync(RENDER_DB_PATH, DB_PATH);
      console.log('Database copied successfully');
    } catch (error) {
      console.error('Error copying database from permanent storage:', error);
    }
  } else {
    console.log('No database found in permanent storage, will create a new one');
  }
}

console.log('SQLite database path:', DB_PATH);

// Создаем подключение к SQLite
const sqlite = new Database(DB_PATH);

// Включаем foreign keys для поддержки связей между таблицами
sqlite.pragma('foreign_keys = ON');

// Создаем экземпляр Drizzle ORM
export const db = drizzle(sqlite, { schema });

// Создаем таблицы в SQLite базе данных
async function createTablesIfNotExist() {
  try {
    console.log('Checking and creating database tables if needed...');
    
    // Создаем таблицы используя SQL
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_regulator INTEGER NOT NULL DEFAULT 0,
        regulator_balance TEXT NOT NULL DEFAULT '0',
        last_nft_generation INTEGER,
        nft_generation_count INTEGER NOT NULL DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        number TEXT NOT NULL,
        expiry TEXT NOT NULL,
        cvv TEXT NOT NULL,
        balance TEXT NOT NULL DEFAULT '0',
        btc_balance TEXT NOT NULL DEFAULT '0',
        eth_balance TEXT NOT NULL DEFAULT '0',
        btc_address TEXT,
        eth_address TEXT
      );
      
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_card_id INTEGER NOT NULL,
        to_card_id INTEGER,
        amount TEXT NOT NULL,
        converted_amount TEXT NOT NULL,
        type TEXT NOT NULL,
        wallet TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        description TEXT NOT NULL DEFAULT '',
        from_card_number TEXT NOT NULL,
        to_card_number TEXT
      );
      
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usd_to_uah TEXT NOT NULL,
        btc_to_usd TEXT NOT NULL,
        eth_to_usd TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
    `);
    
    console.log('Database tables created or verified successfully');
    return true;
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

// Test database connection and log content
async function logDatabaseContent() {
  try {
    console.log('Testing database connection...');
    
    // Проверяем наличие таблиц и пользователей
    let usersResult;
    try {
      usersResult = await db.select().from(schema.users);
      console.log('Successfully connected to database');
      console.log('Users count:', usersResult.length);
    } catch (e) {
      console.log('Users table not ready yet or empty');
      usersResult = [];
    }
    
    // Проверяем карты
    try {
      const cardsResult = await db.select().from(schema.cards);
      console.log('Cards count:', cardsResult.length);
    } catch (e) {
      console.log('Cards table not ready yet or empty');
    }
    
    // Создаем базовые данные если база пуста
    if (usersResult.length === 0) {
      console.log('Database is empty, creating initial data...');
      await createDefaultData();
    }
    
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error; // Propagate the error
  }
}

// Создание начальных данных для тестирования
async function createDefaultData() {
  try {
    // Создаем дефолтные курсы обмена
    await db.insert(schema.exchangeRates).values({
      usdToUah: "40.5",
      btcToUsd: "65000",
      ethToUsd: "3500",
    });
    console.log('Created default exchange rates');
    
    // В реальном коде здесь может быть создание тестовых пользователей
    // для примера, но мы оставим это для регистрации
    
  } catch (error) {
    console.error('Error creating default data:', error);
  }
}

// Export the initialization function
export async function initializeDatabase() {
  try {
    // Создаем таблицы
    await createTablesIfNotExist();
    
    // Проверяем содержимое базы
    await logDatabaseContent();
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Функция для копирования базы данных в постоянное хранилище (для Render.com)
async function backupDatabaseToStorage() {
  if (IS_RENDER && IS_PRODUCTION) {
    try {
      console.log('Backing up database to permanent storage...');
      
      // Копируем файл базы данных в постоянное хранилище
      copyFileSync(DB_PATH, RENDER_DB_PATH);
      console.log('Database backed up successfully to', RENDER_DB_PATH);
      
      // Создаем дополнительную резервную копию в директории data/backup
      const backupDir = path.join(RENDER_DATA_DIR, 'backup');
      if (!existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupPath = path.join(backupDir, `backup_${timestamp}.db`);
      
      // Копируем файл базы данных в директорию бэкапов
      copyFileSync(DB_PATH, backupPath);
      console.log('Additional backup created at', backupPath);
      
      // Удаляем старые бэкапы (оставляем только последние 5)
      const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.db'))
        .sort()
        .reverse();
      
      for (const file of backupFiles.slice(5)) {
        fs.unlinkSync(path.join(backupDir, file));
        console.log('Removed old backup:', file);
      }
      
      return true;
    } catch (error) {
      console.error('Error backing up database to permanent storage:', error);
      return false;
    }
  }
  return true; // Не на Render.com, бэкап не требуется
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Backing up database and closing connection...');
  await backupDatabaseToStorage();
  sqlite.close();
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Backing up database and closing connection...');
  await backupDatabaseToStorage();
  sqlite.close();
});

// Также устанавливаем регулярный бэкап базы данных в постоянное хранилище
if (IS_RENDER && IS_PRODUCTION) {
  // Каждые 15 минут копируем базу в постоянное хранилище
  const BACKUP_INTERVAL = 15 * 60 * 1000; // 15 минут
  
  setInterval(async () => {
    console.log('Running scheduled database backup to permanent storage...');
    const result = await backupDatabaseToStorage();
    if (result) {
      console.log('Scheduled backup to permanent storage completed successfully');
    } else {
      console.error('Scheduled backup to permanent storage failed');
    }
  }, BACKUP_INTERVAL);
}

// Initialize the database connection
initializeDatabase().catch(console.error);