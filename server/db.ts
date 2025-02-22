import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // уменьшаем максимальное количество соединений
  idleTimeoutMillis: 30000, // уменьшаем время простоя до 30 секунд
  connectionTimeoutMillis: 5000,
  ssl: {
    rejectUnauthorized: false
  }
});

let isReconnecting = false;

// Функция для переподключения
async function reconnect() {
  if (isReconnecting) return;

  try {
    isReconnecting = true;
    console.log('Attempting to reconnect to database...');

    // Закрываем все текущие клиенты
    await pool.end();

    // Создаем новый пул
    const newPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Проверяем подключение
    await newPool.query('SELECT 1');

    Object.assign(pool, newPool);
    console.log('Successfully reconnected to database');
  } catch (err) {
    console.error('Failed to reconnect:', err);
    // Пробуем переподключиться через 5 секунд
    setTimeout(reconnect, 5000);
  } finally {
    isReconnecting = false;
  }
}

// Обработка ошибок подключения
pool.on('error', async (err) => {
  console.error('Unexpected error on idle client', err);
  await reconnect();
});

// Мониторинг состояния подключения
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('Connection check failed:', err);
    await reconnect();
  }
}, 30000); // Проверяем каждые 30 секунд

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