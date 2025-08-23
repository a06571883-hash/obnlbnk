import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';
// Используем PostgreSQL базу данных
console.log('Using PostgreSQL database');
// Определяем, запущено ли приложение на Render.com
const IS_RENDER = process.env.RENDER === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Получаем DATABASE_URL из переменных окружения
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}
console.log('Connecting to PostgreSQL database...');
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
            serialize: (date) => date,
            parse: (date) => date
        }
    }
    // Дополнительные параметры доступны, но могут вызывать ошибки TypeScript
    // max_lifetime: 60 * 60, // Максимальное время жизни соединения (1 час)
    // connection_limit: 15, // Увеличенный предел соединений
    // connection_timeout: 30, // Таймаут соединения
    // onError: (err, query) => { ... },
    // onRetry: (count, error) => { ... },
    // retryLimit: 5,
});
// Создаем экземпляр Drizzle ORM
export const db = drizzle(client, { schema });
// Создаем таблицы в PostgreSQL базе данных
async function createTablesIfNotExist() {
    try {
        console.log('Checking and creating database tables if needed...');
        // Создаем таблицы с прямыми SQL запросами
        await client `
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
        await client `
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
        kichcoin_balance TEXT NOT NULL DEFAULT '0',
        btc_address TEXT,
        eth_address TEXT,
        ton_address TEXT
      )
    `;
        await client `
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
        await client `
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        usd_to_uah TEXT NOT NULL,
        btc_to_usd TEXT NOT NULL,
        eth_to_usd TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
        // Создаем таблицу для сессий если её нет
        await client `
      CREATE TABLE IF NOT EXISTS session (
        sid TEXT PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `;
        // Создаем NFT таблицы
        await client `
      CREATE TABLE IF NOT EXISTS nft_collections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        description TEXT,
        cover_image TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
        await client `
      CREATE TABLE IF NOT EXISTS nfts (
        id SERIAL PRIMARY KEY,
        collection_id INTEGER NOT NULL REFERENCES nft_collections(id),
        owner_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        description TEXT,
        image_path TEXT NOT NULL,
        attributes JSONB,
        rarity TEXT NOT NULL DEFAULT 'common',
        price TEXT DEFAULT '0',
        for_sale BOOLEAN NOT NULL DEFAULT false,
        minted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        token_id TEXT NOT NULL,
        original_image_path TEXT,
        sort_order INTEGER
      )
    `;
        await client `
      CREATE TABLE IF NOT EXISTS nft_transfers (
        id SERIAL PRIMARY KEY,
        nft_id INTEGER NOT NULL REFERENCES nfts(id),
        from_user_id INTEGER NOT NULL REFERENCES users(id),
        to_user_id INTEGER NOT NULL REFERENCES users(id),
        transfer_type TEXT NOT NULL,
        price TEXT DEFAULT '0',
        transferred_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
        console.log('Database tables created or verified successfully');
        return true;
    }
    catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
}
// Test database connection and log content
async function logDatabaseContent() {
    try {
        console.log('Testing database connection...');
        // Проверяем наличие таблиц и пользователей
        let usersResult = [];
        try {
            usersResult = await db.select().from(schema.users);
            console.log('Successfully connected to database');
            console.log('Users count:', usersResult.length);
        }
        catch (e) {
            console.log('Users table not ready yet or empty');
            usersResult = [];
        }
        // Проверяем карты
        try {
            const cardsResult = await db.select().from(schema.cards);
            console.log('Cards count:', cardsResult.length);
        }
        catch (e) {
            console.log('Cards table not ready yet or empty');
        }
        // Создаем базовые данные если база пуста
        if (usersResult && usersResult.length === 0) {
            console.log('Database is empty, creating initial data...');
            await createDefaultData();
        }
    }
    catch (error) {
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
            ethToUsd: "3500"
        });
        console.log('Created default exchange rates');
        // В реальном коде здесь может быть создание тестовых пользователей
        // для примера, но мы оставим это для регистрации
    }
    catch (error) {
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
        // Добавляем новые колонки для KICHCOIN если их нет (для существующих таблиц)
        try {
            await client `
        ALTER TABLE cards 
        ADD COLUMN IF NOT EXISTS kichcoin_balance TEXT NOT NULL DEFAULT '0'
      `;
            await client `
        ALTER TABLE cards 
        ADD COLUMN IF NOT EXISTS ton_address TEXT
      `;
            console.log('✅ KICHCOIN колонки успешно добавлены в базу данных');
        }
        catch (error) {
            console.log('⚠️ Ошибка при добавлении KICHCOIN колонок:', error);
        }
        console.log('Database initialization completed successfully');
    }
    catch (error) {
        console.error('Database initialization failed:', error);
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
// Initialize the database connection
initializeDatabase().catch(console.error);
