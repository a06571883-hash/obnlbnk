/**
 * Альтернативный скрипт для импорта данных в PostgreSQL
 * Использует pg вместо postgres.js для обхода ограничений Replit
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

// Получаем DATABASE_URL из переменных окружения
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Необходимо указать DATABASE_URL в переменных окружения');
  process.exit(1);
}

// Создаем пул соединений с PostgreSQL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 5, // максимальное количество клиентов в пуле
  idleTimeoutMillis: 30000, // закрывать неиспользуемые соединения через 30 секунд
  connectionTimeoutMillis: 10000, // таймаут соединения 10 секунд
});

// Обрабатываем ошибки пула
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Путь к JSON файлам с данными
const INPUT_DIR = './attached_assets';
const FILES = {
  users: path.join(INPUT_DIR, 'users (3).json'),
  cards: path.join(INPUT_DIR, 'cards (4).json'),
  transactions: path.join(INPUT_DIR, 'transactions (2).json'),
  exchangeRates: path.join(INPUT_DIR, 'exchange_rates (3).json')
};

// Функция для чтения JSON файла
function readJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Ошибка чтения файла ${filePath}:`, error);
    return [];
  }
}

// Функция для создания таблиц в базе данных
async function createTables() {
  const client = await pool.connect();
  try {
    console.log('Создание таблиц если они не существуют...');
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // Создаем таблицу пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_regulator BOOLEAN NOT NULL DEFAULT false,
        regulator_balance TEXT NOT NULL DEFAULT '0',
        last_nft_generation TIMESTAMP,
        nft_generation_count INTEGER NOT NULL DEFAULT 0
      )
    `);
    
    // Создаем таблицу карт
    await client.query(`
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
    `);
    
    // Создаем таблицу транзакций
    await client.query(`
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
    `);
    
    // Создаем таблицу курсов обмена
    await client.query(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        usd_to_uah TEXT NOT NULL,
        btc_to_usd TEXT NOT NULL,
        eth_to_usd TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Создаем таблицу сессий
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid TEXT PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    console.log('Таблицы успешно созданы');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при создании таблиц:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Импорт пользователей
async function importUsers() {
  const client = await pool.connect();
  try {
    console.log('Импорт пользователей...');
    const users = readJsonFile(FILES.users);
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // Очищаем таблицу пользователей
    await client.query('DELETE FROM users');
    
    // Вставляем пользователей
    for (const user of users) {
      await client.query(`
        INSERT INTO users 
        (id, username, password, is_regulator, regulator_balance, last_nft_generation, nft_generation_count) 
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE 
        SET username = EXCLUDED.username,
            password = EXCLUDED.password,
            is_regulator = EXCLUDED.is_regulator,
            regulator_balance = EXCLUDED.regulator_balance,
            last_nft_generation = EXCLUDED.last_nft_generation,
            nft_generation_count = EXCLUDED.nft_generation_count
      `, [
        user.id,
        user.username,
        user.password,
        user.is_regulator,
        user.regulator_balance,
        user.last_nft_generation ? new Date(user.last_nft_generation) : null,
        user.nft_generation_count
      ]);
    }
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    console.log(`Импортировано ${users.length} пользователей`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при импорте пользователей:', error);
  } finally {
    client.release();
  }
}

// Импорт карт
async function importCards() {
  const client = await pool.connect();
  try {
    console.log('Импорт карт...');
    const cards = readJsonFile(FILES.cards);
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // Очищаем таблицу карт
    await client.query('DELETE FROM cards');
    
    // Вставляем карты
    for (const card of cards) {
      await client.query(`
        INSERT INTO cards 
        (id, user_id, type, number, expiry, cvv, balance, btc_balance, eth_balance, btc_address, eth_address) 
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE 
        SET user_id = EXCLUDED.user_id,
            type = EXCLUDED.type,
            number = EXCLUDED.number,
            expiry = EXCLUDED.expiry,
            cvv = EXCLUDED.cvv,
            balance = EXCLUDED.balance,
            btc_balance = EXCLUDED.btc_balance,
            eth_balance = EXCLUDED.eth_balance,
            btc_address = EXCLUDED.btc_address,
            eth_address = EXCLUDED.eth_address
      `, [
        card.id,
        card.user_id,
        card.type,
        card.number,
        card.expiry,
        card.cvv,
        card.balance,
        card.btc_balance,
        card.eth_balance,
        card.btc_address,
        card.eth_address
      ]);
    }
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    console.log(`Импортировано ${cards.length} карт`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при импорте карт:', error);
  } finally {
    client.release();
  }
}

// Импорт транзакций
async function importTransactions() {
  const client = await pool.connect();
  try {
    console.log('Импорт транзакций...');
    const transactions = readJsonFile(FILES.transactions);
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // Очищаем таблицу транзакций
    await client.query('DELETE FROM transactions');
    
    // Вставляем транзакции
    for (const tx of transactions) {
      await client.query(`
        INSERT INTO transactions 
        (id, from_card_id, to_card_id, amount, converted_amount, type, wallet, status, created_at, description, from_card_number, to_card_number) 
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE 
        SET from_card_id = EXCLUDED.from_card_id,
            to_card_id = EXCLUDED.to_card_id,
            amount = EXCLUDED.amount,
            converted_amount = EXCLUDED.converted_amount,
            type = EXCLUDED.type,
            wallet = EXCLUDED.wallet,
            status = EXCLUDED.status,
            created_at = EXCLUDED.created_at,
            description = EXCLUDED.description,
            from_card_number = EXCLUDED.from_card_number,
            to_card_number = EXCLUDED.to_card_number
      `, [
        tx.id,
        tx.from_card_id,
        tx.to_card_id,
        tx.amount,
        tx.converted_amount,
        tx.type,
        tx.wallet,
        tx.status,
        new Date(tx.created_at),
        tx.description,
        tx.from_card_number,
        tx.to_card_number
      ]);
    }
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    console.log(`Импортировано ${transactions.length} транзакций`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при импорте транзакций:', error);
  } finally {
    client.release();
  }
}

// Импорт курсов обмена
async function importExchangeRates() {
  const client = await pool.connect();
  try {
    console.log('Импорт курсов обмена...');
    const rates = readJsonFile(FILES.exchangeRates);
    
    // Берем только последний курс (первый элемент в JSON файле)
    const latestRate = rates[0];
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // Очищаем таблицу курсов
    await client.query('DELETE FROM exchange_rates');
    
    // Вставляем курс
    await client.query(`
      INSERT INTO exchange_rates 
      (id, usd_to_uah, btc_to_usd, eth_to_usd, updated_at) 
      VALUES 
      ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE 
      SET usd_to_uah = EXCLUDED.usd_to_uah,
          btc_to_usd = EXCLUDED.btc_to_usd,
          eth_to_usd = EXCLUDED.eth_to_usd,
          updated_at = EXCLUDED.updated_at
    `, [
      latestRate.id,
      latestRate.usd_to_uah,
      latestRate.btc_to_usd,
      latestRate.eth_to_usd,
      new Date(latestRate.updated_at)
    ]);
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    console.log(`Курсы обмена успешно импортированы`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при импорте курсов обмена:', error);
  } finally {
    client.release();
  }
}

// Сброс последовательностей ID
async function resetSequences() {
  const client = await pool.connect();
  try {
    console.log('Сброс последовательностей ID...');
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // Сбрасываем последовательности ID
    await client.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users), true)");
    await client.query("SELECT setval('cards_id_seq', (SELECT MAX(id) FROM cards), true)");
    await client.query("SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions), true)");
    await client.query("SELECT setval('exchange_rates_id_seq', (SELECT MAX(id) FROM exchange_rates), true)");
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    console.log('Последовательности ID успешно сброшены');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при сбросе последовательностей ID:', error);
  } finally {
    client.release();
  }
}

// Основная функция импорта
async function importAllData() {
  try {
    console.log('Начало импорта данных...');
    
    // Создаем таблицы
    await createTables();
    
    // Импортируем данные
    await importUsers();
    await importCards();
    await importTransactions();
    await importExchangeRates();
    
    // Сбрасываем последовательности ID
    await resetSequences();
    
    console.log('Все данные успешно импортированы');
  } catch (error) {
    console.error('Ошибка при импорте данных:', error);
  } finally {
    // Закрываем пул соединений
    await pool.end();
  }
}

// Запускаем импорт данных
importAllData();