import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../../shared/schema';
import path from 'path';
import * as fs from 'fs';
import { 
  DatabaseError, 
  AppError, 
  logError 
} from '../error-handler';

// Используем PostgreSQL базу данных
console.log('Using PostgreSQL database');

// Определяем, запущено ли приложение на Render.com
const IS_RENDER = process.env.RENDER === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Получаем DATABASE_URL из переменных окружения
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new DatabaseError('DATABASE_URL environment variable is not set', {
    environmentVariables: Object.keys(process.env).filter(key => 
      key.includes('DB') || key.includes('DATABASE') || key.includes('PG')
    )
  });
}

console.log('Connecting to PostgreSQL database...');

/**
 * Универсальная функция для операций с базой данных с ретраями и обработкой ошибок
 * @param operation Функция, выполняющая запрос к базе данных
 * @param context Контекст операции для логов
 * @param maxRetries Максимальное количество повторных попыток
 * @returns Результат операции
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Повторная попытка ${attempt + 1}/${maxRetries} для операции: ${context}`);
      }
      
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Определяем типы ошибок, которые можно повторить
      const isConnectionError = 
        error.code === '08000' || // Connection exception
        error.code === '08003' || // Connection does not exist
        error.code === '08006' || // Connection failure
        error.code === '08001' || // Unable to connect
        error.code === '08004' || // Rejected connection
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout') ||
        error.message?.includes('connection');
      
      const isTransientError =
        error.code === '40001' || // Serialization failure
        error.code === '40P01' || // Deadlock
        error.code === '57014' || // Query canceled
        error.code === 'XX000'; // Internal error
      
      if ((isConnectionError || isTransientError) && attempt < maxRetries - 1) {
        // Для временных ошибок делаем экспоненциальную задержку
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`⚠️ ${context} не удалось (временная ошибка), повторная попытка через ${delay/1000}s...`);
        console.warn(`   - Код ошибки: ${error.code || 'Нет кода'}`);
        console.warn(`   - Сообщение: ${error.message || 'Нет сообщения'}`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Для критических ошибок
      logError(error);
      
      // Форматируем ошибку перед выбрасыванием
      let enhancedError: AppError;
      
      if (error.code) {
        // Конвертируем ошибку Postgres в нашу структуру
        enhancedError = new DatabaseError(
          `Ошибка базы данных при ${context}: ${error.message}`,
          { 
            code: error.code, 
            detail: error.detail,
            hint: error.hint,
            position: error.position,
            table: error.table,
            column: error.column,
            query: error.query
          }
        );
      } else {
        enhancedError = new DatabaseError(
          `Неизвестная ошибка базы данных при ${context}: ${error.message}`,
          { originalError: error.toString() }
        );
      }
      
      throw enhancedError;
    }
  }
  
  // Если все попытки исчерпаны, выбрасываем последнюю ошибку
  throw lastError || new DatabaseError(`Ошибка при ${context} после ${maxRetries} попыток`);
}

// Создаем клиент подключения к PostgreSQL с параметрами для надежного соединения
export const client = postgres(DATABASE_URL, { 
  ssl: { rejectUnauthorized: false }, // Необходимо для подключения к Neon PostgreSQL
  max: 10, // Максимальное количество соединений в пуле
  idle_timeout: 20, // Timeout для неиспользуемых соединений
  connect_timeout: 30, // Увеличиваем timeout для подключения
  
  // Кастомные типы данных
  types: {
    date: {
      to: 1184,
      from: [1082, 1083, 1114, 1184],
      serialize: (date: Date) => date,
      parse: (date: string) => date
    }
  },
  
  // Обработчики ошибок (работают только если вызывать запросы через client напрямую)
  onError: (err, sql) => {
    console.error('🔴 PostgreSQL error:', err);
    logError(new DatabaseError(
      `Ошибка при выполнении SQL: ${err.message}`,
      { 
        code: err.code,
        query: sql.substring(0, 200) + (sql.length > 200 ? '...' : '')
      }
    ));
  },
  
  // Обработчик повторных попыток
  onRetry: (count, error) => {
    console.warn(`⚠️ PostgreSQL retry #${count} due to:`, error.message);
  },
  
  // Лимит повторных попыток для client
  retryLimit: 3
});

// Создаем экземпляр Drizzle ORM
export const db = drizzle(client, { schema });

// Создаем таблицы в PostgreSQL базе данных
async function createTablesIfNotExist() {
  return withDatabaseRetry(async () => {
    console.log('Checking and creating database tables if needed...');
    
    // Создаем таблицы с прямыми SQL запросами
    await client`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_regulator BOOLEAN NOT NULL DEFAULT false,
        regulator_balance TEXT NOT NULL DEFAULT '0',
        last_nft_generation TIMESTAMP,
        nft_generation_count INTEGER NOT NULL DEFAULT 0
      )
    `;
    
    await client`
      CREATE TABLE IF NOT EXISTS cards (
        id SERIAL PRIMARY KEY,
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
      )
    `;
    
    await client`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        from_card_id INTEGER NOT NULL,
        to_card_id INTEGER,
        amount TEXT NOT NULL,
        converted_amount TEXT NOT NULL,
        type TEXT NOT NULL,
        wallet TEXT,
        status TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        description TEXT NOT NULL DEFAULT '',
        from_card_number TEXT NOT NULL,
        to_card_number TEXT
      )
    `;
    
    await client`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        usd_to_uah TEXT NOT NULL,
        btc_to_usd TEXT NOT NULL,
        eth_to_usd TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    // Создаем таблицу для сессий если её нет
    await client`
      CREATE TABLE IF NOT EXISTS session (
        sid TEXT PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `;
    
    console.log('Database tables created or verified successfully');
    return true;
  }, 'создание таблиц в базе данных', 3);
}

// Test database connection and log content
async function logDatabaseContent() {
  return withDatabaseRetry(async () => {
    console.log('Testing database connection...');
    
    // Проверяем наличие таблиц и пользователей
    let usersResult: schema.User[] = [];
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
    if (usersResult && usersResult.length === 0) {
      console.log('Database is empty, creating initial data...');
      await createDefaultData();
    }
    
  }, 'проверка содержимого базы данных', 3);
}

// Создание начальных данных для тестирования
async function createDefaultData() {
  return withDatabaseRetry(async () => {
    // Создаем дефолтные курсы обмена
    await db.insert(schema.exchangeRates).values({
      usdToUah: "40.5",
      btcToUsd: "65000",
      ethToUsd: "3500"
    });
    console.log('Created default exchange rates');
    
    // В реальном коде здесь может быть создание тестовых пользователей
    // для примера, но мы оставим это для регистрации
    
  }, 'создание начальных данных в базе', 2);
}

// Export the initialization function
export async function initializeDatabase() {
  try {
    console.log('Initializing database tables...');
    
    // Создаем таблицы
    await createTablesIfNotExist();
    
    // Проверяем содержимое базы
    await logDatabaseContent();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    
    // Логируем и выбрасываем ошибку
    logError(error instanceof AppError ? error : new DatabaseError(
      `Ошибка инициализации базы данных: ${(error as Error).message}`
    ));
    
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Closing database connection...');
  await client.end();
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Closing database connection...');
  await client.end();
});

// Экспортируем все необходимые функции и объекты
export default {
  db,
  client,
  initializeDatabase,
  withDatabaseRetry
};