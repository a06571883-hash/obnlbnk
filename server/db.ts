import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 300000, // увеличиваем таймаут простоя до 5 минут
  connectionTimeoutMillis: 10000, // увеличиваем таймаут подключения до 10 секунд
  ssl: {
    rejectUnauthorized: false
  }
});

// Обработка ошибок подключения
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Не завершаем процесс при ошибке, пытаемся восстановить соединение
  pool.connect().catch(connectErr => {
    console.error('Failed to reconnect:', connectErr);
  });
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

// Проверяем подключение при старте
pool.connect()
  .then(() => console.log('Initial connection to PostgreSQL successful'))
  .catch(err => {
    console.error('Initial connection error:', err);
    // Продолжаем работу, так как подключение может восстановиться
  });

export const db = drizzle(pool);

// Export pool for session store usage
export { pool };