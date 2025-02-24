import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Оптимизированные настройки пула для работы с сессиями
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  max: 20,
  idleTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Улучшенная обработка ошибок пула
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', () => {
  console.log('New database connection established');
  console.log('Database URL:', process.env.DATABASE_URL?.split('@')[1]); // Логируем только часть URL без креденшиалов
});

pool.on('error', (err) => {
  console.error('Database connection error:', err.message);
});

// Создаем экземпляр базы данных drizzle
export const db = drizzle(pool, { schema });

// Проверяем содержимое базы данных
async function logDatabaseContent() {
  console.log('Checking database content...');
  try {
    const usersResult = await db.select().from(schema.users);
    console.log('Users in database:', usersResult);
    
    const cardsResult = await db.select().from(schema.cards);
    console.log('Cards in database:', cardsResult);
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

logDatabaseContent();

// Корректное завершение пула при выходе
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing pool...');
  pool.end();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing pool...');
  pool.end();
});