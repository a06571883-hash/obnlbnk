import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // уменьшаем максимальное количество соединений
  idleTimeoutMillis: 30000, // уменьшаем время простоя до 30 секунд
  connectionTimeoutMillis: 5000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Функция для переподключения
async function reconnect() {
  try {
    await pool.end();
    await pool.connect();
    console.log('Successfully reconnected to database');
  } catch (err) {
    console.error('Failed to reconnect:', err);
    // Пробуем переподключиться через 5 секунд
    setTimeout(reconnect, 5000);
  }
}

// Обработка ошибок подключения
pool.on('error', async (err) => {
  console.error('Unexpected error on idle client', err);
  await reconnect();
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

// Проверяем подключение при старте
pool.connect()
  .then(() => console.log('Initial connection to PostgreSQL successful'))
  .catch(async (err) => {
    console.error('Initial connection error:', err);
    await reconnect();
  });

export const db = drizzle(pool);

// Export pool for session store usage
export { pool };