/**
 * Скрипт для импорта данных из JSON-файлов в PostgreSQL базу данных
 * Импортирует пользователей, карты, транзакции и курсы обмена
 */

import fs from 'fs';
import path from 'path';
import { db, client } from './server/db.js';
import * as schema from './shared/schema.js';

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
    await client`TRUNCATE TABLE users RESTART IDENTITY CASCADE`;
    
    // Вставляем пользователей
    for (const user of users) {
      await db.insert(schema.users).values({
        // id: user.id, // Не указываем id, чтобы PostgreSQL сам сгенерировал его
        username: user.username,
        password: user.password,
        is_regulator: user.is_regulator,
        regulator_balance: user.regulator_balance,
        last_nft_generation: user.last_nft_generation ? new Date(user.last_nft_generation) : null,
        nft_generation_count: user.nft_generation_count
      });
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
    await client`TRUNCATE TABLE cards RESTART IDENTITY CASCADE`;
    
    // Вставляем карты
    for (const card of cards) {
      await db.insert(schema.cards).values({
        // id: card.id, // Не указываем id, чтобы PostgreSQL сам сгенерировал его
        userId: card.user_id,
        type: card.type,
        number: card.number,
        expiry: card.expiry,
        cvv: card.cvv,
        balance: card.balance,
        btcBalance: card.btc_balance,
        ethBalance: card.eth_balance,
        btcAddress: card.btc_address,
        ethAddress: card.eth_address
      });
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
    await client`TRUNCATE TABLE transactions RESTART IDENTITY CASCADE`;
    
    // Вставляем транзакции
    for (const tx of transactions) {
      await db.insert(schema.transactions).values({
        // id: tx.id, // Не указываем id, чтобы PostgreSQL сам сгенерировал его
        fromCardId: tx.from_card_id,
        toCardId: tx.to_card_id,
        amount: tx.amount,
        convertedAmount: tx.converted_amount,
        type: tx.type,
        wallet: tx.wallet,
        status: tx.status,
        createdAt: new Date(tx.created_at),
        description: tx.description,
        fromCardNumber: tx.from_card_number,
        toCardNumber: tx.to_card_number
      });
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
    await client`TRUNCATE TABLE exchange_rates RESTART IDENTITY CASCADE`;
    
    // Вставляем курс
    await db.insert(schema.exchangeRates).values({
      usdToUah: latestRate.usd_to_uah,
      btcToUsd: latestRate.btc_to_usd,
      ethToUsd: latestRate.eth_to_usd,
      updatedAt: new Date(latestRate.updated_at)
    });
    
    console.log(`Imported exchange rates successfully`);
  } catch (error) {
    console.error('Error importing exchange rates:', error);
  }
}

// Основная функция импорта
async function importAllData() {
  try {
    console.log('Starting data import...');
    
    // Запускаем импорт в правильном порядке
    await importUsers();
    await importCards();
    await importTransactions();
    await importExchangeRates();
    
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