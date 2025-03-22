/**
 * Скрипт для импорта данных через новый URL эндпоинта Neon
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

// Получает информацию о доступных проектах и эндпоинтах в Neon
async function getNeonConnectionInfo() {
  try {
    // Получаем список проектов
    console.log('Получение списка проектов Neon...');
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
    const project = projects.projects[0]; // Берем первый проект
    
    if (!project) {
      throw new Error('Проект не найден');
    }
    
    console.log(`Найден проект: ${project.name} (${project.id})`);
    
    // Получаем список эндпоинтов
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
    const endpoint = endpoints.endpoints[0]; // Берем первый эндпоинт
    
    if (!endpoint) {
      throw new Error('Эндпоинт не найден');
    }
    
    console.log(`Найден эндпоинт: ${endpoint.id} (${endpoint.host})`);
    
    // Получаем информацию о подключении
    const connectionInfo = {
      projectId: project.id,
      endpointId: endpoint.id,
      host: endpoint.host,
      databaseName: 'neondb', // Стандартное имя базы данных Neon
      user: 'neondb_owner', // Стандартный пользователь Neon
    };
    
    console.log('Информация о подключении успешно получена');
    return connectionInfo;
  } catch (error) {
    console.error('Ошибка получения информации о подключении:', error);
    return null;
  }
}

// Активирует эндпоинт Neon
async function activateEndpoint(projectId, endpointId) {
  try {
    console.log(`Активация эндпоинта ${endpointId}...`);
    
    const activateResponse = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/endpoints/${endpointId}/start`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${NEON_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!activateResponse.ok) {
      // Если эндпоинт уже активен, это не считается ошибкой
      if (activateResponse.status === 409) {
        console.log(`Эндпоинт ${endpointId} уже активен`);
        return true;
      }
      throw new Error(`Ошибка активации эндпоинта: ${activateResponse.statusText}`);
    }
    
    console.log(`Эндпоинт ${endpointId} успешно активирован`);
    
    // Даем эндпоинту время на полную активацию
    console.log('Ждем 5 секунд для полной активации эндпоинта...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return true;
  } catch (error) {
    console.error('Ошибка активации эндпоинта:', error);
    return false;
  }
}

// Получает пароль для подключения к базе данных
async function getDatabasePassword(projectId, databaseName) {
  try {
    console.log(`Получение информации о базе данных ${databaseName}...`);
    
    const databasesResponse = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/databases`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${NEON_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!databasesResponse.ok) {
      throw new Error(`Ошибка получения списка баз данных: ${databasesResponse.statusText}`);
    }
    
    const databases = await databasesResponse.json();
    const database = databases.databases.find(db => db.name === databaseName);
    
    if (!database) {
      throw new Error(`База данных ${databaseName} не найдена`);
    }
    
    console.log(`Найдена база данных: ${database.name} (${database.id})`);
    
    // Получаем информацию о ролях (пользователях)
    const rolesResponse = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/branches/main/roles`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${NEON_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rolesResponse.ok) {
      throw new Error(`Ошибка получения списка ролей: ${rolesResponse.statusText}`);
    }
    
    const roles = await rolesResponse.json();
    console.log(`Найдено ${roles.roles.length} ролей`);
    
    // Запрашиваем пароль для первой роли
    if (roles.roles.length > 0) {
      const role = roles.roles[0];
      
      const passwordResponse = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/branches/main/roles/${role.name}/reveal_password`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${NEON_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!passwordResponse.ok) {
        throw new Error(`Ошибка получения пароля: ${passwordResponse.statusText}`);
      }
      
      const passwordData = await passwordResponse.json();
      console.log(`Получен пароль для роли ${role.name}`);
      
      return {
        username: role.name,
        password: passwordData.password
      };
    } else {
      throw new Error('Не найдено ролей для получения пароля');
    }
  } catch (error) {
    console.error('Ошибка получения пароля для базы данных:', error);
    return null;
  }
}

// Импорт данных в базу данных
async function importData(connectionUrl) {
  try {
    console.log('Начинаем импорт данных...');
    console.log(`Подключение к базе данных: ${connectionUrl}`);
    
    // Создаем подключение к Neon PostgreSQL
    const sql = neon(connectionUrl);
    
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
    return true;
  } catch (error) {
    console.error('Ошибка при импорте данных:', error);
    return false;
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
    // Получаем информацию о подключении
    const connectionInfo = await getNeonConnectionInfo();
    
    if (!connectionInfo) {
      console.error('Не удалось получить информацию о подключении. Импорт данных отменен.');
      return;
    }
    
    // Активируем эндпоинт
    const activated = await activateEndpoint(connectionInfo.projectId, connectionInfo.endpointId);
    
    if (!activated) {
      console.error('Не удалось активировать эндпоинт. Импорт данных отменен.');
      return;
    }
    
    // Извлекаем учетные данные из DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    const match = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@[^\/]+\/([^?]+)/);
    
    if (!match) {
      console.error('Не удалось извлечь учетные данные из DATABASE_URL. Импорт данных отменен.');
      return;
    }
    
    const username = match[1];
    const password = match[2];
    const database = match[3];
    
    // Создаем URL для подключения с новым хостом эндпоинта
    console.log('Создаем URL для активного эндпоинта с нашими учетными данными');
    const connectionUrl = `postgres://${username}:${password}@${connectionInfo.host}/${database}?sslmode=require`;
    
    // Выводим данные для отладки (без пароля)
    const sanitizedUrl = connectionUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`Использую URL для подключения: ${sanitizedUrl}`);
    
    // Импортируем данные
    await importData(connectionUrl);
  } catch (error) {
    console.error('Ошибка в основной функции:', error);
  }
}

// Запускаем скрипт
main();