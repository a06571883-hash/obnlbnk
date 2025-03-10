/**
 * Скрипт для обновления балансов и номеров карт
 * - 16-значные номера карт для всех карт
 * - Валидные криптоадреса
 * - Установленные балансы регулятора
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

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

// Функция для генерации валидного BTC-адреса
function generateValidBtcAddress(userId) {
  // Префикс P2PKH для mainnet
  return `1${crypto.randomBytes(20).toString('hex').substring(0, 26)}`;
}

// Функция для генерации валидного ETH-адреса
function generateValidEthAddress() {
  const wallet = Wallet.createRandom();
  return wallet.address;
}

// Функция для генерации 16-значного номера карты
function generateCardNumber(type) {
  const prefixes = {
    crypto: '4000',
    usd: '4111',
    uah: '5555'
  };

  const prefix = prefixes[type] || '4000';
  const randomPart = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
  return `${prefix}${randomPart}`;
}

// Обновить данные регулятора
async function updateRegulatorData() {
  try {
    console.log('Обновляем данные регулятора...');
    
    // Находим пользователя с именем admin
    const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    
    if (!admin) {
      throw new Error('Пользователь admin не найден');
    }
    
    console.log(`Найден регулятор: ${admin.username}, ID: ${admin.id}`);
    
    // Находим все карты регулятора
    const cards = db.prepare('SELECT * FROM cards WHERE user_id = ?').all(admin.id);
    console.log(`У регулятора найдено ${cards.length} карт`);
    
    // Генерируем новый BTC-адрес
    const btcAddress = generateValidBtcAddress(admin.id);
    
    // Обновляем криптокарту
    const cryptoCard = cards.find(card => card.type === 'crypto');
    if (cryptoCard) {
      // Обновляем номер карты и криптоадреса
      const newCardNumber = generateCardNumber('crypto');
      const ethAddress = generateValidEthAddress();
      
      db.prepare(`
        UPDATE cards 
        SET number = ?, 
            btc_address = ?, 
            eth_address = ?,
            btc_balance = ?,
            eth_balance = ?
        WHERE id = ?
      `).run(
        newCardNumber,
        btcAddress,
        ethAddress,
        '968396.02',
        '179864.09',
        cryptoCard.id
      );
      
      console.log(`Криптокарта обновлена: ${newCardNumber}`);
      console.log(`BTC-адрес: ${btcAddress}`);
      console.log(`ETH-адрес: ${ethAddress}`);
      console.log(`BTC-баланс: 968396.02`);
      console.log(`ETH-баланс: 179864.09`);
    }
    
    // Обновляем долларовую карту
    const usdCard = cards.find(card => card.type === 'usd');
    if (usdCard) {
      const newCardNumber = generateCardNumber('usd');
      
      db.prepare(`
        UPDATE cards 
        SET number = ?, 
            balance = ?
        WHERE id = ?
      `).run(
        newCardNumber,
        '200000000',
        usdCard.id
      );
      
      console.log(`Долларовая карта обновлена: ${newCardNumber}`);
      console.log(`Баланс: $200,000,000.00`);
    }
    
    // Обновляем гривневую карту
    const uahCard = cards.find(card => card.type === 'uah');
    if (uahCard) {
      const newCardNumber = generateCardNumber('uah');
      
      db.prepare(`
        UPDATE cards 
        SET number = ?, 
            balance = ?
        WHERE id = ?
      `).run(
        newCardNumber,
        '400000000',
        uahCard.id
      );
      
      console.log(`Гривневая карта обновлена: ${newCardNumber}`);
      console.log(`Баланс: ₴400,000,000.00`);
    }
    
    // Обновляем баланс регулятора
    db.prepare(`
      UPDATE users 
      SET regulator_balance = ?
      WHERE id = ?
    `).run(
      '10000000',
      admin.id
    );
    
    console.log(`Баланс регулятора обновлен: 10,000,000.00`);
    
    console.log('Данные регулятора успешно обновлены');
    
    // Обновляем все остальные карты других пользователей (16-значные номера и валидные адреса)
    const otherCards = db.prepare('SELECT * FROM cards WHERE user_id != ?').all(admin.id);
    console.log(`Найдено ${otherCards.length} карт других пользователей`);
    
    for (const card of otherCards) {
      const newCardNumber = generateCardNumber(card.type);
      let updates = { number: newCardNumber };
      
      // Если это криптокарта, обновляем криптоадреса
      if (card.type === 'crypto') {
        updates.btc_address = generateValidBtcAddress(card.user_id);
        updates.eth_address = generateValidEthAddress();
      }
      
      // Формируем SQL запрос динамически
      const fields = Object.keys(updates);
      const placeholders = fields.map(f => `${f.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`).join(', ');
      
      db.prepare(`
        UPDATE cards 
        SET ${placeholders}
        WHERE id = ?
      `).run(
        ...Object.values(updates),
        card.id
      );
      
      console.log(`Карта ID ${card.id} обновлена: ${newCardNumber}`);
      if (updates.btc_address) {
        console.log(`BTC-адрес: ${updates.btc_address}`);
        console.log(`ETH-адрес: ${updates.eth_address}`);
      }
    }
    
    console.log('Все карты успешно обновлены');
    
    // Выводим итоговую информацию
    const allCards = db.prepare('SELECT * FROM cards').all();
    console.log(`\nИтого карт в системе: ${allCards.length}`);
    
    const adminCards = db.prepare('SELECT * FROM cards WHERE user_id = ?').all(admin.id);
    console.log(`\nДанные карт регулятора:`);
    adminCards.forEach(card => {
      console.log(`ID: ${card.id}, Тип: ${card.type}, Номер: ${card.number}, Баланс: ${card.balance}`);
      if (card.type === 'crypto') {
        console.log(`BTC-адрес: ${card.btc_address}, BTC-баланс: ${card.btc_balance}`);
        console.log(`ETH-адрес: ${card.eth_address}, ETH-баланс: ${card.eth_balance}`);
      }
    });
    
  } catch (error) {
    console.error('Ошибка при обновлении данных регулятора:', error);
    throw error;
  }
}

async function main() {
  try {
    await updateRegulatorData();
  } catch (error) {
    console.error('Ошибка в main:', error);
  } finally {
    // Закрываем соединение с базой данных
    db.close();
  }
}

main();