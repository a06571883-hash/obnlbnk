/**
 * Скрипт для импорта данных из JSON-файлов в PostgreSQL базу данных
 * Импортирует пользователей, карты, транзакции и курсы обмена
 */

import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './shared/schema.js';

// Получение URL базы данных из переменной окружения
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL не указан в переменных окружения');
  process.exit(1);
}

// Создаем подключение к PostgreSQL с оптимизированными параметрами
const client = postgres(DATABASE_URL, { 
  ssl: { rejectUnauthorized: false },
  max: 2,
  idle_timeout: 10,
  connect_timeout: 15,
  types: {
    date: {
      to: 1184,
      from: [1082, 1083, 1114, 1184],
      serialize: (date) => date,
      parse: (date) => date
    }
  }
});

// Создаем экземпляр Drizzle ORM
const db = drizzle(client, { schema });

const INPUT_DIR = './attached_assets';
const FILES = {
  users: path.join(INPUT_DIR, 'users (3).json'),
  cards: path.join(INPUT_DIR, 'cards (4).json'),
  transactions: path.join(INPUT_DIR, 'transactions (2).json'),
  exchangeRates: path.join(INPUT_DIR, 'exchange_rates (3).json')
};

// Функция для чтения JSON из файла
function readJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

// Импорт пользователей
async function importUsers() {
  try {
    console.log('Importing users...');
    const users = readJsonFile(FILES.users);
    
    // Очищаем таблицу пользователей перед импортом
    try {
      await db.delete(schema.users);
      console.log('Users table cleared');
    } catch (error) {
      console.error('Error clearing users table:', error);
    }
    
    // Вставляем пользователей с сохранением оригинальных ID
    for (const user of users) {
      try {
        // Используем прямой SQL запрос для вставки с конкретным ID
        await client`
          INSERT INTO users 
          (id, username, password, is_regulator, regulator_balance, last_nft_generation, nft_generation_count) 
          VALUES 
          (${user.id}, ${user.username}, ${user.password}, ${user.is_regulator}, ${user.regulator_balance}, 
           ${user.last_nft_generation ? new Date(user.last_nft_generation) : null}, ${user.nft_generation_count})
          ON CONFLICT (id) DO UPDATE 
          SET username = EXCLUDED.username,
              password = EXCLUDED.password,
              is_regulator = EXCLUDED.is_regulator,
              regulator_balance = EXCLUDED.regulator_balance,
              last_nft_generation = EXCLUDED.last_nft_generation,
              nft_generation_count = EXCLUDED.nft_generation_count;
        `;
      } catch (error) {
        console.error(`Error importing user ${user.username}:`, error);
      }
    }
    
    console.log(`Imported ${users.length} users successfully`);
  } catch (error) {
    console.error('Error importing users:', error);
  }
}

// Импорт карт
async function importCards() {
  try {
    console.log('Importing cards...');
    const cards = readJsonFile(FILES.cards);
    
    // Очищаем таблицу карт перед импортом
    try {
      await db.delete(schema.cards);
      console.log('Cards table cleared');
    } catch (error) {
      console.error('Error clearing cards table:', error);
    }
    
    // Вставляем карты с сохранением оригинальных ID
    for (const card of cards) {
      try {
        // Используем прямой SQL запрос для вставки с конкретным ID
        await client`
          INSERT INTO cards 
          (id, user_id, type, number, expiry, cvv, balance, btc_balance, eth_balance, btc_address, eth_address) 
          VALUES 
          (${card.id}, ${card.user_id}, ${card.type}, ${card.number}, ${card.expiry}, ${card.cvv}, 
           ${card.balance}, ${card.btc_balance}, ${card.eth_balance}, ${card.btc_address}, ${card.eth_address})
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
              eth_address = EXCLUDED.eth_address;
        `;
      } catch (error) {
        console.error(`Error importing card ${card.id}:`, error);
      }
    }
    
    console.log(`Imported ${cards.length} cards successfully`);
  } catch (error) {
    console.error('Error importing cards:', error);
  }
}

// Импорт транзакций
async function importTransactions() {
  try {
    console.log('Importing transactions...');
    const transactions = readJsonFile(FILES.transactions);
    
    // Очищаем таблицу транзакций перед импортом
    try {
      await db.delete(schema.transactions);
      console.log('Transactions table cleared');
    } catch (error) {
      console.error('Error clearing transactions table:', error);
    }
    
    // Вставляем транзакции с сохранением оригинальных ID
    for (const tx of transactions) {
      try {
        // Используем прямой SQL запрос для вставки с конкретным ID
        await client`
          INSERT INTO transactions 
          (id, from_card_id, to_card_id, amount, converted_amount, type, wallet, status, created_at, description, from_card_number, to_card_number) 
          VALUES 
          (${tx.id}, ${tx.from_card_id}, ${tx.to_card_id}, ${tx.amount}, ${tx.converted_amount}, ${tx.type}, 
           ${tx.wallet}, ${tx.status}, ${new Date(tx.created_at)}, ${tx.description}, ${tx.from_card_number}, ${tx.to_card_number})
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
              to_card_number = EXCLUDED.to_card_number;
        `;
      } catch (error) {
        console.error(`Error importing transaction ${tx.id}:`, error);
      }
    }
    
    console.log(`Imported ${transactions.length} transactions successfully`);
  } catch (error) {
    console.error('Error importing transactions:', error);
  }
}

// Импорт курсов обмена
async function importExchangeRates() {
  try {
    console.log('Importing exchange rates...');
    const rates = readJsonFile(FILES.exchangeRates);
    
    // Берем только последнее значение курса
    const latestRate = rates[0]; // Первый элемент в JSON-файле - самый новый
    
    // Очищаем таблицу курсов перед импортом
    try {
      await db.delete(schema.exchangeRates);
      console.log('Exchange rates table cleared');
    } catch (error) {
      console.error('Error clearing exchange rates table:', error);
    }
    
    // Вставляем курс с сохранением оригинального ID
    try {
      await client`
        INSERT INTO exchange_rates 
        (id, usd_to_uah, btc_to_usd, eth_to_usd, updated_at) 
        VALUES 
        (${latestRate.id}, ${latestRate.usd_to_uah}, ${latestRate.btc_to_usd}, ${latestRate.eth_to_usd}, ${new Date(latestRate.updated_at)})
        ON CONFLICT (id) DO UPDATE 
        SET usd_to_uah = EXCLUDED.usd_to_uah,
            btc_to_usd = EXCLUDED.btc_to_usd,
            eth_to_usd = EXCLUDED.eth_to_usd,
            updated_at = EXCLUDED.updated_at;
      `;
    } catch (error) {
      console.error('Error importing exchange rate:', error);
    }
    
    console.log(`Imported exchange rates successfully`);
  } catch (error) {
    console.error('Error importing exchange rates:', error);
  }
}

// Создание таблиц в PostgreSQL
async function createTables() {
  try {
    console.log('Creating tables if they do not exist...');
    
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
    
    console.log('Tables created or verified successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

// Сброс последовательностей ID после импорта
async function resetSequences() {
  try {
    console.log('Resetting ID sequences...');
    
    // Получаем максимальный ID для каждой таблицы и сбрасываем последовательности
    await client`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users), true)`;
    await client`SELECT setval('cards_id_seq', (SELECT MAX(id) FROM cards), true)`;
    await client`SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions), true)`;
    await client`SELECT setval('exchange_rates_id_seq', (SELECT MAX(id) FROM exchange_rates), true)`;
    
    console.log('ID sequences reset successfully');
  } catch (error) {
    console.error('Error resetting sequences:', error);
  }
}

// Основная функция импорта
async function importAllData() {
  try {
    console.log('Starting data import...');
    
    // Создаем таблицы если их нет
    await createTables();
    
    // Запускаем импорт в правильном порядке с учетом зависимостей
    await importUsers();
    await importCards();
    await importTransactions();
    await importExchangeRates();
    
    // Сбрасываем последовательности ID после импорта
    await resetSequences();
    
    console.log('All data imported successfully');
  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    // Закрываем соединение с БД
    await client.end();
    process.exit(0);
  }
}

// Запускаем импорт
importAllData();