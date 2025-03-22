/**
 * Скрипт для импорта данных в локальную PostgreSQL базу данных
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';

// Получаем данные для подключения из переменных окружения
const {
  PGHOST,
  PGPORT,
  PGUSER,
  PGPASSWORD,
  PGDATABASE
} = process.env;

// Формируем строку подключения
const connectionString = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}`;
console.log(`Подключение к базе данных с использованием pg...`);
console.log(`Host: ${PGHOST}, Port: ${PGPORT}, Database: ${PGDATABASE}, User: ${PGUSER}`);

// Путь к JSON файлам
const INPUT_DIR = './attached_assets';
const FILES = {
  users: path.join(INPUT_DIR, 'users (3).json'),
  cards: path.join(INPUT_DIR, 'cards (4).json'),
  transactions: path.join(INPUT_DIR, 'transactions (2).json'),
  exchangeRates: path.join(INPUT_DIR, 'exchange_rates (3).json'),
  session: path.join(INPUT_DIR, 'session (2).json')
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

// Создаем клиент подключения к PostgreSQL с SSL
const client = new pg.Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Необходимо для подключения к Neon PostgreSQL
  }
});

// Импорт данных в базу данных
async function importData() {
  try {
    // Подключаемся к базе данных
    await client.connect();
    console.log('Успешное подключение к PostgreSQL базе данных');
    
    // Создаем таблицы если их нет
    await createTables();
    
    // Импортируем данные
    await importUsers();
    await importCards();
    await importTransactions();
    await importExchangeRates();
    await importSessions();
    
    // Сбрасываем последовательности ID
    await resetSequences();
    
    console.log('Данные успешно импортированы!');
  } catch (error) {
    console.error('Ошибка при импорте данных:', error);
  } finally {
    // Закрываем соединение
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Создание таблиц
async function createTables() {
  try {
    console.log('Создаем таблицы...');
    
    // Таблица пользователей
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
    
    // Таблица карт
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
    
    // Таблица транзакций
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
    
    // Таблица курсов обмена
    await client.query(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        usd_to_uah TEXT NOT NULL,
        btc_to_usd TEXT NOT NULL,
        eth_to_usd TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Таблица сессий
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid TEXT PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    
    console.log('Таблицы успешно созданы');
  } catch (error) {
    console.error('Ошибка при создании таблиц:', error);
    throw error;
  }
}

// Импорт пользователей
async function importUsers() {
  try {
    console.log('Импорт пользователей...');
    const users = readJsonFile(FILES.users);
    
    // Очищаем таблицу пользователей
    await client.query('DELETE FROM users');
    
    // Добавляем пользователей
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
    
    console.log(`Импортировано ${users.length} пользователей`);
  } catch (error) {
    console.error('Ошибка при импорте пользователей:', error);
  }
}

// Импорт карт
async function importCards() {
  try {
    console.log('Импорт карт...');
    const cards = readJsonFile(FILES.cards);
    
    // Очищаем таблицу карт
    await client.query('DELETE FROM cards');
    
    // Добавляем карты
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
    
    console.log(`Импортировано ${cards.length} карт`);
  } catch (error) {
    console.error('Ошибка при импорте карт:', error);
  }
}

// Импорт транзакций
async function importTransactions() {
  try {
    console.log('Импорт транзакций...');
    const transactions = readJsonFile(FILES.transactions);
    
    // Очищаем таблицу транзакций
    await client.query('DELETE FROM transactions');
    
    // Добавляем транзакции
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
    
    console.log(`Импортировано ${transactions.length} транзакций`);
  } catch (error) {
    console.error('Ошибка при импорте транзакций:', error);
  }
}

// Импорт курсов обмена
async function importExchangeRates() {
  try {
    console.log('Импорт курсов обмена...');
    const rates = readJsonFile(FILES.exchangeRates);
    
    // Берем последний курс обмена
    const latestRate = rates[0];
    
    // Очищаем таблицу курсов обмена
    await client.query('DELETE FROM exchange_rates');
    
    // Добавляем курс обмена
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
    
    console.log('Курсы обмена успешно импортированы');
  } catch (error) {
    console.error('Ошибка при импорте курсов обмена:', error);
  }
}

// Импорт сессий
async function importSessions() {
  try {
    console.log('Импорт сессий...');
    const sessions = readJsonFile(FILES.session);
    
    // Очищаем таблицу сессий
    await client.query('DELETE FROM session');
    
    // Добавляем сессии
    for (const session of sessions) {
      await client.query(`
        INSERT INTO session
        (sid, sess, expire)
        VALUES
        ($1, $2, $3)
        ON CONFLICT (sid) DO UPDATE
        SET sess = EXCLUDED.sess,
            expire = EXCLUDED.expire
      `, [
        session.sid,
        session.sess,
        new Date(session.expire)
      ]);
    }
    
    console.log(`Импортировано ${sessions.length} сессий`);
  } catch (error) {
    console.error('Ошибка при импорте сессий:', error);
  }
}

// Сброс последовательностей ID
async function resetSequences() {
  try {
    console.log('Сброс последовательностей ID...');
    
    await client.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users), true)");
    await client.query("SELECT setval('cards_id_seq', (SELECT MAX(id) FROM cards), true)");
    await client.query("SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions), true)");
    await client.query("SELECT setval('exchange_rates_id_seq', (SELECT MAX(id) FROM exchange_rates), true)");
    
    console.log('Последовательности ID успешно сброшены');
  } catch (error) {
    console.error('Ошибка при сбросе последовательностей ID:', error);
  }
}

// Запускаем импорт данных
importData();