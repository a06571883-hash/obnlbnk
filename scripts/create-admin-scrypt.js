/**
 * Скрипт для создания пользователя-регулятора admin в SQLite базе данных
 * Используется тот же алгоритм хеширования пароля, что и в приложении (scrypt)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import path from 'path';
import { fileURLToPath } from 'url';
import { Wallet } from '@ethersproject/wallet';
import crypto from 'crypto';
import { promisify } from 'util';
import Database from 'better-sqlite3';

// Получаем текущую директорию для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к файлу базы данных
const DB_PATH = path.join(path.dirname(__dirname), 'sqlite.db');
console.log('SQLite database path:', DB_PATH);

// Создаем подключение к SQLite
const db = new Database(DB_PATH);

// Функции для хеширования пароля, идентичные тем, что используются в server/auth.ts
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = (await scrypt(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
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

// Функция для создания транзакций
function createSampleTransactions(userId, cardIds) {
  try {
    console.log('Создаем примерные транзакции...');
    
    const transactionTypes = ['deposit', 'withdrawal', 'transfer', 'exchange'];
    const statuses = ['completed', 'pending', 'failed', 'completed'];
    
    for (let i = 0; i < 5; i++) {
      const typeIndex = Math.floor(Math.random() * transactionTypes.length);
      const type = transactionTypes[typeIndex];
      const status = statuses[typeIndex];
      const amount = (Math.random() * 1000).toFixed(2);
      const fromCardId = cardIds[Math.floor(Math.random() * cardIds.length)];
      const toCardId = (type === 'transfer') ? cardIds[Math.floor(Math.random() * cardIds.length)] : null;
      
      // Создаем транзакцию
      const stmt = db.prepare(`
        INSERT INTO transactions (
          type, status, amount, from_card_id, to_card_id, 
          created_at, from_card_number, to_card_number, description, wallet,
          converted_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = new Date().toISOString();
      const fromCard = db.prepare('SELECT number FROM cards WHERE id = ?').get(fromCardId);
      const toCard = toCardId ? db.prepare('SELECT number FROM cards WHERE id = ?').get(toCardId) : null;
      
      const description = type === 'deposit' 
        ? 'Пополнение счета' 
        : type === 'withdrawal' 
          ? 'Снятие средств' 
          : type === 'transfer' 
            ? 'Перевод средств' 
            : 'Обмен валюты';
      
      const wallet = type === 'deposit' || type === 'withdrawal' 
        ? Math.random() > 0.5 
          ? generateBtcAddress(userId) 
          : generateEthAddress() 
        : null;
      
      // Добавляем сконвертированную сумму
      const convertedAmount = type === 'exchange' 
        ? (parseFloat(amount) * 41.25).toFixed(2) // примерный курс USD к UAH
        : amount;
      
      const result = stmt.run(
        type,
        status,
        amount,
        fromCardId,
        toCardId,
        now,
        fromCard?.number || '',
        toCard?.number || '',
        description,
        wallet,
        convertedAmount
      );
      
      console.log(`Транзакция создана, ID: ${result.lastInsertRowid}`);
    }
    
    console.log('Примерные транзакции созданы успешно');
  } catch (error) {
    console.error('Ошибка при создании транзакций:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Проверяем наличие пользователя-админа...');
    
    // Проверяем, существует ли уже админ
    const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    
    if (existingAdmin) {
      console.log('Пользователь admin уже существует. Удаляем для пересоздания...');
      
      // Удаляем все транзакции связанные с картами пользователя
      const cards = db.prepare('SELECT id FROM cards WHERE user_id = ?').all(existingAdmin.id);
      const cardIds = cards.map(card => card.id);
      
      if (cardIds.length > 0) {
        const placeholders = cardIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM transactions WHERE from_card_id IN (${placeholders}) OR to_card_id IN (${placeholders})`).run(
          ...cardIds, ...cardIds
        );
      }
      
      // Удаляем карты пользователя
      db.prepare('DELETE FROM cards WHERE user_id = ?').run(existingAdmin.id);
      
      // Удаляем пользователя
      db.prepare('DELETE FROM users WHERE id = ?').run(existingAdmin.id);
      
      console.log('Пользователь admin удален для пересоздания');
    }
    
    // Создаем админа с использованием scrypt для хеширования пароля
    const passwordHash = await hashPassword('admin123');
    console.log('Пароль захеширован с использованием scrypt:', passwordHash);
    
    const stmt = db.prepare(`
      INSERT INTO users (username, password, is_regulator, regulator_balance)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run('admin', passwordHash, 1, '2000000');
    const adminId = result.lastInsertRowid;
    
    console.log('Пользователь-админ создан, ID:', adminId);
    
    // Создаем карты для админа
    createCardsForUser(adminId);
    
    // Получаем все карты админа для создания транзакций
    const adminCards = db.prepare('SELECT id FROM cards WHERE user_id = ?').all(adminId);
    const adminCardIds = adminCards.map(card => card.id);
    
    // Создаем транзакции
    createSampleTransactions(adminId, adminCardIds);
    
    console.log('Пользователь admin успешно создан со всеми картами и транзакциями');
    
    // Выводим все карты
    const allCards = db.prepare('SELECT * FROM cards').all();
    console.log(`Всего карт в системе: ${allCards.length}`);
    
    // Выводим все транзакции
    const allTransactions = db.prepare('SELECT * FROM transactions').all();
    console.log(`Всего транзакций в системе: ${allTransactions.length}`);
    
  } catch (error) {
    console.error('Ошибка при создании админа:', error);
  } finally {
    // Закрываем соединение с базой данных
    db.close();
  }
}

main();