/**
 * Скрипт для создания пользователя-регулятора в SQLite базе данных
 * Запускается один раз для создания регулятора, если его еще нет
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Wallet } from '@ethersproject/wallet';
import crypto from 'crypto';
import Database from 'better-sqlite3';

// Получаем текущую директорию для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к файлу базы данных
const DB_PATH = path.join(path.dirname(__dirname), 'sqlite.db');
console.log('SQLite database path:', DB_PATH);

// Создаем подключение к SQLite
const db = new Database(DB_PATH);

// Функция для создания хеша пароля
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Функция для генерации BTC-адреса (фейковый валидный)
function generateBtcAddress(userId) {
  return `1BTC${userId.toString().padStart(6, '0')}${crypto.randomBytes(16).toString('hex').substring(0, 22)}`;
}

// Функция для генерации ETH-адреса
function generateEthAddress() {
  const wallet = Wallet.createRandom();
  return wallet.address;
}

// Функция для генерации номера карты
function generateCardNumber(type) {
  const prefixes = {
    crypto: '4000',
    usd: '4111',
    uah: '5555'
  };

  const prefix = prefixes[type] || '4000';
  const randomPart = Math.floor(Math.random() * 10000000000000).toString().padStart(12, '0');
  return `${prefix}${randomPart}`;
}

// Функция для генерации срока действия карты
function generateExpiryDate() {
  const currentYear = new Date().getFullYear();
  const year = (currentYear + 3) % 100;
  const month = Math.floor(Math.random() * 12) + 1;
  return `${month.toString().padStart(2, '0')}/${year.toString().padStart(2, '0')}`;
}

// Функция для генерации CVV
function generateCVV() {
  return Math.floor(Math.random() * 900 + 100).toString();
}

// Функция для создания карт для пользователя
function createCardsForUser(userId) {
  console.log(`Создаем карты для пользователя с ID ${userId}...`);
  
  try {
    // Создаем три типа карт для пользователя
    const cardTypes = ['crypto', 'usd', 'uah'];
    
    for (const type of cardTypes) {
      // Генерируем данные карты
      const cardNumber = generateCardNumber(type);
      const expiry = generateExpiryDate();
      const cvv = generateCVV();
      
      // Генерируем криптоадреса для криптокарты
      let btcAddress = null;
      let ethAddress = null;
      
      if (type === 'crypto') {
        btcAddress = generateBtcAddress(userId);
        ethAddress = generateEthAddress();
      }
      
      // Создаем карту в базе данных
      const stmt = db.prepare(`
        INSERT INTO cards (user_id, type, number, expiry, cvv, balance, btc_balance, eth_balance, btc_address, eth_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const balance = type === 'usd' ? '1000' : (type === 'uah' ? '40000' : '0');
      const btcBalance = type === 'crypto' ? '0.001' : '0';
      const ethBalance = type === 'crypto' ? '0.01' : '0';
      
      const result = stmt.run(
        userId,
        type,
        cardNumber,
        expiry,
        cvv,
        balance,
        btcBalance,
        ethBalance,
        btcAddress,
        ethAddress
      );
      
      console.log(`Карта типа ${type} создана для пользователя ${userId}, ID карты: ${result.lastInsertRowid}`);
    }
    
    console.log(`Карты для пользователя с ID ${userId} созданы успешно`);
  } catch (error) {
    console.error(`Ошибка при создании карт для пользователя с ID ${userId}:`, error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Проверяем наличие регулятора...');
    
    // Проверяем, существует ли уже регулятор
    const existingRegulator = db.prepare('SELECT * FROM users WHERE is_regulator = 1').get();
    
    if (existingRegulator) {
      console.log('Регулятор уже существует:', existingRegulator);
      return;
    }
    
    // Создаем регулятора
    const passwordHash = await hashPassword('regulator123');
    
    const stmt = db.prepare(`
      INSERT INTO users (username, password, is_regulator, regulator_balance)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run('regulator', passwordHash, 1, '1000000');
    const regulatorId = result.lastInsertRowid;
    
    console.log('Регулятор создан, ID:', regulatorId);
    
    // Создаем карты для регулятора
    createCardsForUser(regulatorId);
    
    console.log('Регулятор успешно создан со всеми картами');
    
    // Выводим все карты
    const allCards = db.prepare('SELECT * FROM cards').all();
    console.log(`Всего карт в системе: ${allCards.length}`);
    
  } catch (error) {
    console.error('Ошибка при создании регулятора:', error);
  } finally {
    // Закрываем соединение с базой данных
    db.close();
  }
}

main();