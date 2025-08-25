/**
 * Скрипт для создания тестовых данных в базе данных
 * Создаем регулятора и обычного пользователя с картами
 */

import bcrypt from 'bcryptjs';
import { db } from '../server/db.js';
import { users, cards } from "../shared/schema"';
import { generateValidAddress } from '../server/utils/crypto.js';
import { eq } from 'drizzle-orm';

// Функция для создания хеша пароля
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Функция для генерации номера карты
function generateCardNumber(type: 'crypto' | 'usd' | 'uah'): string {
  const prefixes: Record<string, string> = {
    crypto: '4000',
    usd: '4111',
    uah: '5555'
  };

  const prefix = prefixes[type] || '4000';
  const randomPart = Math.floor(Math.random() * 10000000000000).toString().padStart(12, '0');
  return `${prefix}${randomPart}`;
}

// Функция для генерации срока действия карты
function generateExpiryDate(): string {
  const currentYear = new Date().getFullYear();
  const year = (currentYear + 3) % 100;
  const month = Math.floor(Math.random() * 12) + 1;
  return `${month.toString().padStart(2, '0')}/${year.toString().padStart(2, '0')}`;
}

// Функция для генерации CVV
function generateCVV(): string {
  return Math.floor(Math.random() * 900 + 100).toString();
}

// Функция для создания регулятора
async function createRegulator() {
  console.log('Создаем пользователя-регулятора...');
  
  try {
    // Проверяем, существует ли уже регулятор
    const existingRegulator = await db.select().from(users).where(eq(users.is_regulator, true)).limit(1);
    
    if (existingRegulator.length > 0) {
      console.log('Регулятор уже существует:', existingRegulator[0]);
      return existingRegulator[0];
    }

    // Создаем регулятора
    const passwordHash = await hashPassword('regulator123');
    
    const [regulator] = await db.insert(users).values({
      username: 'regulator',
      password: passwordHash,
      is_regulator: true,
      regulator_balance: '1000000'
    }).returning();
    
    console.log('Регулятор создан:', regulator);
    
    // Создаем карты для регулятора
    await createCardsForUser(regulator.id);
    
    return regulator;
  } catch (error) {
    console.error('Ошибка при создании регулятора:', error);
    throw error;
  }
}

// Функция для создания обычного пользователя
async function createRegularUser() {
  console.log('Создаем обычного пользователя...');
  
  try {
    // Проверяем, существует ли уже пользователь
    const existingUser = await db.select().from(users).where(eq(users.username, 'user1')).limit(1);
    
    if (existingUser.length > 0) {
      console.log('Пользователь уже существует:', existingUser[0]);
      return existingUser[0];
    }

    // Создаем пользователя
    const passwordHash = await hashPassword('password123');
    
    const [user] = await db.insert(users).values({
      username: 'user1',
      password: passwordHash,
      is_regulator: false
    }).returning();
    
    console.log('Пользователь создан:', user);
    
    // Создаем карты для пользователя
    await createCardsForUser(user.id);
    
    return user;
  } catch (error) {
    console.error('Ошибка при создании пользователя:', error);
    throw error;
  }
}

// Функция для создания карт для пользователя
async function createCardsForUser(userId: number) {
  console.log(`Создаем карты для пользователя с ID ${userId}...`);
  
  try {
    // Создаем три типа карт для пользователя
    const cardTypes: ('crypto' | 'usd' | 'uah')[] = ['crypto', 'usd', 'uah'];
    
    for (const type of cardTypes) {
      // Генерируем данные карты
      const cardNumber = generateCardNumber(type);
      const expiry = generateExpiryDate();
      const cvv = generateCVV();
      
      // Генерируем криптоадреса для криптокарты
      let btcAddress: string | null = null;
      let ethAddress: string | null = null;
      
      if (type === 'crypto') {
        btcAddress = generateValidAddress('btc', userId);
        ethAddress = generateValidAddress('eth', userId);
      }
      
      // Создаем карту в базе данных
      const [card] = await db.insert(cards).values({
        userId,
        type,
        number: cardNumber,
        expiry,
        cvv,
        balance: type === 'usd' ? '1000' : (type === 'uah' ? '40000' : '0'),
        btcBalance: type === 'crypto' ? '0.001' : '0',
        ethBalance: type === 'crypto' ? '0.01' : '0',
        btcAddress,
        ethAddress
      }).returning();
      
      console.log(`Карта типа ${type} создана:`, card);
    }
    
    console.log(`Карты для пользователя с ID ${userId} созданы успешно`);
  } catch (error) {
    console.error(`Ошибка при создании карт для пользователя с ID ${userId}:`, error);
    throw error;
  }
}

// Основная функция
async function createTestData() {
  try {
    console.log('Начинаем создание тестовых данных...');
    
    // Создаем регулятора
    const regulator = await createRegulator();
    
    // Создаем обычного пользователя
    const user = await createRegularUser();
    
    console.log('Тестовые данные созданы успешно');
    console.log('Регулятор:', regulator);
    console.log('Пользователь:', user);
    
    // Выводим все карты
    const allCards = await db.select().from(cards);
    console.log(`Всего карт в системе: ${allCards.length}`);
    
    // Выводим криптокарты
    const cryptoCards = allCards.filter(card => card.type === 'crypto');
    console.log('Криптокарты:', cryptoCards);
  } catch (error) {
    console.error('Ошибка при создании тестовых данных:', error);
  }
}

// Запускаем создание тестовых данных
createTestData().catch(console.error);