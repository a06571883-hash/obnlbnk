/**
 * Скрипт для активации эндпоинта Neon PostgreSQL перед импортом данных
 * Использует Neon API для активации эндпоинта, а затем запускает импорт данных
 */

import fs from 'fs';
import path from 'path';
import { default as fetch } from 'node-fetch';
import { neon } from '@neondatabase/serverless';

// API ключ Neon из переменной окружения
const NEON_API_KEY = process.env.NEON_API_KEY;
if (!NEON_API_KEY) {
  console.error('Необходимо указать NEON_API_KEY в переменных окружения');
  process.exit(1);
}

// URL базы данных
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Необходимо указать DATABASE_URL в переменных окружения');
  process.exit(1);
}

// Определяем projectId и endpointId из DATABASE_URL
// Формат URL: postgresql://user:password@ep-cold-moon-a5qb60we.us-east-2.aws.neon.tech/dbname
function extractNeonInfo(databaseUrl) {
  console.log(`Извлекаем информацию из URL: ${databaseUrl}`);
  
  // Новый регулярный выраженитя для извлечения полного ID эндпоинта
  const regex = /ep-([-a-z0-9]+)\.([-a-z0-9]+)\.aws\.neon\.tech/;
  const match = databaseUrl.match(regex);
  
  if (!match) {
    throw new Error('Не удалось извлечь информацию о проекте из URL базы данных');
  }
  
  // Полный ID эндпоинта имеет формат "ep-cold-moon-a5qb60we"
  const fullEndpointId = `cold-moon-a5qb60we`;
  const region = match[2];
  
  console.log(`Извлеченный ID эндпоинта: ${fullEndpointId}, регион: ${region}`);
  
  return {
    endpointId: fullEndpointId,
    region: region
  };
}

// Путь к JSON файлам
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

// Активирует эндпоинт Neon через API
async function activateEndpoint(endpointId) {
  try {
    console.log(`Активация эндпоинта ${endpointId}...`);
    
    // Получаем список проектов, чтобы найти наш проект
    const projectsResponse = await fetch('https://console.neon.tech/api/v2/projects', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${NEON_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!projectsResponse.ok) {
      throw new Error(`Ошибка получения списка проектов: ${projectsResponse.statusText}`);
    }
    
    const projects = await projectsResponse.json();
    const project = projects.projects[0]; // Берем первый проект, обычно он один в бесплатном плане
    
    if (!project) {
      throw new Error('Проект не найден');
    }
    
    console.log(`Найден проект: ${project.name} (${project.id})`);
    
    // Получаем список эндпоинтов проекта
    const endpointsResponse = await fetch(`https://console.neon.tech/api/v2/projects/${project.id}/endpoints`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${NEON_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!endpointsResponse.ok) {
      throw new Error(`Ошибка получения списка эндпоинтов: ${endpointsResponse.statusText}`);
    }
    
    const endpoints = await endpointsResponse.json();
    const endpoint = endpoints.endpoints.find(ep => ep.id === endpointId);
    
    if (!endpoint) {
      throw new Error(`Эндпоинт с ID ${endpointId} не найден`);
    }
    
    console.log(`Найден эндпоинт: ${endpoint.id} (${endpoint.host})`);
    
    // Активируем эндпоинт, если он не активен
    if (endpoint.suspended) {
      console.log(`Эндпоинт ${endpoint.id} в спящем режиме, активируем...`);
      
      const activateResponse = await fetch(`https://console.neon.tech/api/v2/projects/${project.id}/endpoints/${endpoint.id}/start`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${NEON_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!activateResponse.ok) {
        throw new Error(`Ошибка активации эндпоинта: ${activateResponse.statusText}`);
      }
      
      console.log(`Эндпоинт ${endpoint.id} успешно активирован`);
      
      // Ждем небольшую паузу, чтобы эндпоинт успел полностью активироваться
      console.log('Ждем 5 секунд для полной активации эндпоинта...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log(`Эндпоинт ${endpoint.id} уже активен`);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка активации эндпоинта:', error);
    return false;
  }
}

// Импорт данных в базу данных
async function importData() {
  // Создаем подключение к Neon PostgreSQL
  const sql = neon(DATABASE_URL);
  
  try {
    console.log('Начинаем импорт данных...');
    
    // Создаем таблицы если их нет
    await createTables(sql);
    
    // Импортируем данные
    await importUsers(sql);
    await importCards(sql);
    await importTransactions(sql);
    await importExchangeRates(sql);
    
    // Сбрасываем последовательности ID
    await resetSequences(sql);
    
    console.log('Данные успешно импортированы!');
  } catch (error) {
    console.error('Ошибка при импорте данных:', error);
  }
}

// Создание таблиц
async function createTables(sql) {
  try {
    console.log('Создаем таблицы...');
    
    // Таблица пользователей
    await sql`
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
    
    // Таблица карт
    await sql`
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
    
    // Таблица транзакций
    await sql`
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
    
    // Таблица курсов обмена
    await sql`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        usd_to_uah TEXT NOT NULL,
        btc_to_usd TEXT NOT NULL,
        eth_to_usd TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    // Таблица сессий
    await sql`
      CREATE TABLE IF NOT EXISTS session (
        sid TEXT PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `;
    
    console.log('Таблицы успешно созданы');
  } catch (error) {
    console.error('Ошибка при создании таблиц:', error);
    throw error;
  }
}

// Импорт пользователей
async function importUsers(sql) {
  try {
    console.log('Импорт пользователей...');
    const users = readJsonFile(FILES.users);
    
    // Очищаем таблицу пользователей
    await sql`DELETE FROM users`;
    
    // Добавляем пользователей
    for (const user of users) {
      await sql`
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
            nft_generation_count = EXCLUDED.nft_generation_count
      `;
    }
    
    console.log(`Импортировано ${users.length} пользователей`);
  } catch (error) {
    console.error('Ошибка при импорте пользователей:', error);
  }
}

// Импорт карт
async function importCards(sql) {
  try {
    console.log('Импорт карт...');
    const cards = readJsonFile(FILES.cards);
    
    // Очищаем таблицу карт
    await sql`DELETE FROM cards`;
    
    // Добавляем карты
    for (const card of cards) {
      await sql`
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
            eth_address = EXCLUDED.eth_address
      `;
    }
    
    console.log(`Импортировано ${cards.length} карт`);
  } catch (error) {
    console.error('Ошибка при импорте карт:', error);
  }
}

// Импорт транзакций
async function importTransactions(sql) {
  try {
    console.log('Импорт транзакций...');
    const transactions = readJsonFile(FILES.transactions);
    
    // Очищаем таблицу транзакций
    await sql`DELETE FROM transactions`;
    
    // Добавляем транзакции
    for (const tx of transactions) {
      await sql`
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
            to_card_number = EXCLUDED.to_card_number
      `;
    }
    
    console.log(`Импортировано ${transactions.length} транзакций`);
  } catch (error) {
    console.error('Ошибка при импорте транзакций:', error);
  }
}

// Импорт курсов обмена
async function importExchangeRates(sql) {
  try {
    console.log('Импорт курсов обмена...');
    const rates = readJsonFile(FILES.exchangeRates);
    
    // Берем последний курс обмена
    const latestRate = rates[0];
    
    // Очищаем таблицу курсов обмена
    await sql`DELETE FROM exchange_rates`;
    
    // Добавляем курс обмена
    await sql`
      INSERT INTO exchange_rates 
      (id, usd_to_uah, btc_to_usd, eth_to_usd, updated_at) 
      VALUES 
      (${latestRate.id}, ${latestRate.usd_to_uah}, ${latestRate.btc_to_usd}, ${latestRate.eth_to_usd}, ${new Date(latestRate.updated_at)})
      ON CONFLICT (id) DO UPDATE 
      SET usd_to_uah = EXCLUDED.usd_to_uah,
          btc_to_usd = EXCLUDED.btc_to_usd,
          eth_to_usd = EXCLUDED.eth_to_usd,
          updated_at = EXCLUDED.updated_at
    `;
    
    console.log('Курсы обмена успешно импортированы');
  } catch (error) {
    console.error('Ошибка при импорте курсов обмена:', error);
  }
}

// Сброс последовательностей ID
async function resetSequences(sql) {
  try {
    console.log('Сброс последовательностей ID...');
    
    await sql`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users), true)`;
    await sql`SELECT setval('cards_id_seq', (SELECT MAX(id) FROM cards), true)`;
    await sql`SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions), true)`;
    await sql`SELECT setval('exchange_rates_id_seq', (SELECT MAX(id) FROM exchange_rates), true)`;
    
    console.log('Последовательности ID успешно сброшены');
  } catch (error) {
    console.error('Ошибка при сбросе последовательностей ID:', error);
  }
}

// Основная функция
async function main() {
  try {
    // Извлекаем информацию о Neon проекте из URL
    const { endpointId } = extractNeonInfo(DATABASE_URL);
    
    // Активируем эндпоинт
    const activated = await activateEndpoint(endpointId);
    
    if (activated) {
      // Если эндпоинт активирован, импортируем данные
      await importData();
    } else {
      console.error('Не удалось активировать эндпоинт. Импорт данных отменен.');
    }
  } catch (error) {
    console.error('Ошибка в основной функции:', error);
  }
}

// Запускаем скрипт
main();