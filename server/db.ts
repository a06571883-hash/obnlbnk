import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync } from 'fs';
import path from 'path';

// Используем локальную SQLite базу данных вместо Neon PostgreSQL
console.log('Using SQLite as the database (completely free and no expiration)');

// Путь к файлу базы данных
const DB_PATH = path.join(process.cwd(), 'sqlite.db');
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

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing SQLite connection...');
  sqlite.close();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing SQLite connection...');
  sqlite.close();
});

// Initialize the database connection
initializeDatabase().catch(console.error);