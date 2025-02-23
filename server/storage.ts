import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { db } from "./db";
import { cards, users, transactions } from "@shared/schema";
import type { User, Card, InsertUser, Transaction } from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const PostgresSessionStore = connectPg(session);

const scryptAsync = promisify(scrypt);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCardsByUserId(userId: number): Promise<Card[]>;
  createCard(card: Omit<Card, "id">): Promise<Card>;
  sessionStore: session.Store;
  getAllUsers(): Promise<User[]>;
  updateRegulatorBalance(userId: number, balance: string): Promise<void>;
  updateCardBalance(cardId: number, balance: string): Promise<void>;
  updateCardBtcBalance(cardId: number, balance: string): Promise<void>;
  updateCardEthBalance(cardId: number, balance: string): Promise<void>;
  getCardById(cardId: number): Promise<Card | undefined>;
  getCardByNumber(cardNumber: string): Promise<Card | undefined>;
  getTransactionsByCardId(cardId: number): Promise<Transaction[]>;
  createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction>;
  transferMoney(fromCardId: number, toCardNumber: string, amount: number, wallet?: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    console.log('Initializing DatabaseStorage with PostgreSQL session store...');
    try {
      this.sessionStore = new PostgresSessionStore({
        pool,
        tableName: 'sessions',
        schemaName: 'public',
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 60 * 1000, // 1 hour
        errorLog: (err) => {
          console.error('Session store error:', err);
        }
      });
      console.log('PostgreSQL session store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize session store:', error);
      throw error;
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`${context} failed (attempt ${attempt + 1}/3):`, error);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastError || new Error(`${context} failed after 3 attempts`);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.withRetry(async () => {
      console.log(`Getting user by ID: ${id}`);
      const [user] = await db.select().from(users).where(eq(users.id, id));
      console.log(`User found: ${user ? 'yes' : 'no'}`);
      return user;
    }, 'Get user');
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      console.log(`Finding user by username: ${username}`);
      const [user] = await db.select().from(users).where(eq(users.username, username));
      console.log('Found user by username:', user ? 'yes' : 'no');
      return user;
    }, 'Get user by username');
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      console.log('Creating user:', insertUser.username);
      const [user] = await db.insert(users).values(insertUser).returning();
      console.log('User created successfully:', user.username);
      return user;
    }, 'Create user');
  }

  async getCardsByUserId(userId: number): Promise<Card[]> {
    return this.withRetry(async () => {
      return await db.select().from(cards).where(eq(cards.userId, userId));
    }, 'Get cards by user ID');
  }

  async createCard(card: Omit<Card, "id">): Promise<Card> {
    return this.withRetry(async () => {
      const [result] = await db.insert(cards).values(card).returning();
      return result;
    }, 'Create card');
  }

  async getAllUsers(): Promise<User[]> {
    return this.withRetry(async () => {
      return await db.select().from(users);
    }, 'Get all users');
  }

  async updateRegulatorBalance(userId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(users)
        .set({ regulator_balance: balance })
        .where(eq(users.id, userId));
    }, 'Update regulator balance');
  }

  async updateCardBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(cards)
        .set({ balance: balance })
        .where(eq(cards.id, cardId));
    }, 'Update card balance');
  }

  async getCardById(cardId: number): Promise<Card | undefined> {
    return this.withRetry(async () => {
      const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
      return card;
    }, 'Get card by ID');
  }

  async getCardByNumber(cardNumber: string): Promise<Card | undefined> {
    return this.withRetry(async () => {
      const cleanCardNumber = cardNumber.replace(/\s+/g, '');
      const [card] = await db.select().from(cards).where(eq(cards.number, cleanCardNumber));
      console.log('Searching for card with number:', cleanCardNumber, 'Found:', card ? 'yes' : 'no');
      return card;
    }, 'Get card by number');
  }

  async getTransactionsByCardId(cardId: number): Promise<Transaction[]> {
    return this.withRetry(async () => {
      return await db.select()
        .from(transactions)
        .where(
          or(
            eq(transactions.fromCardId, cardId),
            eq(transactions.toCardId, cardId)
          )
        )
        .orderBy(desc(transactions.createdAt));
    }, 'Get transactions by card ID');
  }

  async createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
    return this.withRetry(async () => {
      console.log('Creating transaction:', transaction);
      const [result] = await db.insert(transactions).values({
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount,
        convertedAmount: transaction.convertedAmount,
        description: transaction.description,
        fromCardId: transaction.fromCardId,
        toCardId: transaction.toCardId,
        wallet: transaction.wallet || null,
        fromCardNumber: transaction.fromCardNumber || null,
        toCardNumber: transaction.toCardNumber || null,
        createdAt: transaction.createdAt || new Date()
      }).returning();
      console.log('Transaction created:', result);
      return result;
    }, 'Create transaction');
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number, wallet?: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withRetry(async () => {
      console.log(`Начало перевода: fromCardId=${fromCardId}, toCardNumber=${toCardNumber}, amount=${amount}, wallet=${wallet}`);

      // Базовая валидация
      if (!fromCardId || !toCardNumber || amount <= 0) {
        return {
          success: false,
          error: "Неверные параметры перевода. Сумма должна быть больше 0"
        };
      }

      // Получаем карту отправителя
      const fromCard = await this.getCardById(fromCardId);
      if (!fromCard) {
        return {
          success: false,
          error: "Карта отправителя не найдена или недоступна"
        };
      }

      // Перевод криптовалюты
      if (wallet) {
        if (fromCard.type !== 'crypto') {
          return {
            success: false,
            error: "Для перевода криптовалюты используйте крипто-карту"
          };
        }

        const balance = wallet === 'btc' ?
          parseFloat(fromCard.btcBalance || '0') :
          parseFloat(fromCard.ethBalance || '0');

        if (isNaN(balance)) {
          return {
            success: false,
            error: `Ошибка чтения баланса ${wallet.toUpperCase()}`
          };
        }

        if (balance < amount) {
          return {
            success: false,
            error: `Недостаточно ${wallet.toUpperCase()} на балансе. Доступно: ${balance.toFixed(8)} ${wallet.toUpperCase()}, требуется: ${amount.toFixed(8)} ${wallet.toUpperCase()}`
          };
        }

        try {
          const newBalance = (balance - amount).toFixed(8);

          const transaction = await this.createTransaction({
            fromCardId: fromCard.id,
            toCardId: fromCard.id,
            amount: amount.toString(),
            convertedAmount: amount.toString(),
            type: 'transfer',
            status: 'completed',
            wallet,
            description: `Перевод ${amount.toFixed(8)} ${wallet.toUpperCase()} на адрес ${toCardNumber}`,
            fromCardNumber: fromCard.number,
            toCardNumber: toCardNumber,
            createdAt: new Date()
          });

          if (wallet === 'btc') {
            await this.updateCardBtcBalance(fromCard.id, newBalance);
          } else {
            await this.updateCardEthBalance(fromCard.id, newBalance);
          }

          console.log(`Успешный крипто-перевод: ${amount} ${wallet}`);
          return { success: true, transaction };
        } catch (error) {
          console.error('Ошибка крипто-перевода:', error);
          return {
            success: false,
            error: "Произошла ошибка при переводе криптовалюты. Пожалуйста, попробуйте позже"
          };
        }
      }

      // Обычный перевод между картами
      try {
        const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
        if (cleanToCardNumber.length !== 16) {
          return {
            success: false,
            error: "Неверный формат номера карты. Номер должен состоять из 16 цифр"
          };
        }

        const toCard = await this.getCardByNumber(cleanToCardNumber);
        if (!toCard) {
          return {
            success: false,
            error: "Карта получателя не найдена. Проверьте номер карты"
          };
        }

        if (fromCard.id === toCard.id) {
          return {
            success: false,
            error: "Невозможно выполнить перевод на ту же карту"
          };
        }

        const fromBalance = parseFloat(fromCard.balance || '0');
        const toBalance = parseFloat(toCard.balance || '0');

        if (isNaN(fromBalance) || isNaN(toBalance)) {
          return {
            success: false,
            error: "Ошибка при чтении баланса карт"
          };
        }

        if (fromBalance < amount) {
          return {
            success: false,
            error: `Недостаточно средств на карте. Доступно: ${fromBalance.toFixed(2)} ${fromCard.type.toUpperCase()}, требуется: ${amount.toFixed(2)} ${fromCard.type.toUpperCase()}`
          };
        }

        const newFromBalance = (fromBalance - amount).toFixed(2);
        const newToBalance = (toBalance + amount).toFixed(2);

        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: toCard.id,
          amount: amount.toString(),
          convertedAmount: amount.toString(),
          type: 'transfer',
          status: 'completed',
          wallet: null,
          description: `Перевод ${amount.toFixed(2)} ${fromCard.type.toUpperCase()}`,
          fromCardNumber: fromCard.number,
          toCardNumber: toCard.number,
          createdAt: new Date()
        });

        await this.updateCardBalance(fromCard.id, newFromBalance);
        await this.updateCardBalance(toCard.id, newToBalance);

        console.log(`Успешный перевод: ${amount} ${fromCard.type}`);
        return { success: true, transaction };
      } catch (error) {
        console.error('Ошибка перевода между картами:', error);
        return {
          success: false,
          error: "Произошла ошибка при переводе. Пожалуйста, попробуйте позже"
        };
      }
    }, 'Transfer money');
  }

  async updateCardBtcBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(cards)
        .set({ btcBalance: balance })
        .where(eq(cards.id, cardId));
    }, 'Update card BTC balance');
  }

  async updateCardEthBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(cards)
        .set({ ethBalance: balance })
        .where(eq(cards.id, cardId));
    }, 'Update card ETH balance');
  }
}

export const storage = new DatabaseStorage();