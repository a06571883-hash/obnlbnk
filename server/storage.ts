import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { db } from "./db";
import { cards, users, transactions } from "@shared/schema";
import type { User, Card, InsertUser, Transaction } from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

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
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    });
  }

  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`${context} failed (attempt ${attempt + 1}/3):`, error);
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
    throw lastError || new Error(`${context} failed after 3 attempts`);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    }, 'Get user');
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    }, 'Get user by username');
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      const [user] = await db.insert(users).values(insertUser).returning();
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
      return card;
    }, 'Get card by number');
  }

  async getTransactionsByCardId(cardId: number): Promise<Transaction[]> {
    return this.withRetry(async () => {
      return await db.select()
        .from(transactions)
        .where(or(eq(transactions.fromCardId, cardId), eq(transactions.toCardId, cardId)))
        .orderBy(desc(transactions.createdAt));
    }, 'Get transactions by card ID');
  }

  async createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
    return this.withRetry(async () => {
      const [result] = await db.insert(transactions).values({
        ...transaction,
        createdAt: new Date()
      }).returning();
      return result;
    }, 'Create transaction');
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number, wallet?: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withRetry(async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const fromCard = await this.getCardById(fromCardId);
        if (!fromCard) {
          throw new Error("Карта отправителя не найдена");
        }

        // Крипто-перевод
        if (wallet) {
          if (fromCard.type !== 'crypto') {
            throw new Error("Для крипто-перевода используйте крипто-карту");
          }

          const balance = wallet === 'btc' ? fromCard.btcBalance : fromCard.ethBalance;
          const numBalance = Number(balance || '0');

          if (isNaN(numBalance)) {
            throw new Error(`Ошибка формата баланса ${wallet.toUpperCase()}`);
          }

          if (numBalance < amount) {
            throw new Error(`Недостаточно ${wallet.toUpperCase()}. Доступно: ${numBalance.toFixed(8)} ${wallet.toUpperCase()}`);
          }

          const newBalance = (numBalance - amount).toFixed(8);

          // Создаём транзакцию
          const transaction = await this.createTransaction({
            fromCardId: fromCard.id,
            toCardId: null,
            amount: amount.toString(),
            convertedAmount: amount.toString(),
            type: 'transfer',
            status: 'completed',
            wallet: wallet,
            description: `Перевод ${amount.toFixed(8)} ${wallet.toUpperCase()} на адрес ${toCardNumber}`,
            fromCardNumber: fromCard.number,
            toCardNumber: toCardNumber,
            createdAt: new Date()
          });

          // Обновляем баланс
          if (wallet === 'btc') {
            await this.updateCardBtcBalance(fromCard.id, newBalance);
          } else {
            await this.updateCardEthBalance(fromCard.id, newBalance);
          }

          await client.query('COMMIT');
          return { success: true, transaction };
        }

        // Фиатный перевод
        const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
        const toCard = await this.getCardByNumber(cleanToCardNumber);

        if (!toCard) {
          throw new Error("Карта получателя не найдена");
        }

        if (fromCard.id === toCard.id) {
          throw new Error("Невозможно перевести на ту же карту");
        }

        const fromBalance = Number(fromCard.balance || '0');
        const toBalance = Number(toCard.balance || '0');

        if (isNaN(fromBalance) || isNaN(toBalance)) {
          throw new Error("Ошибка формата баланса");
        }

        if (fromBalance < amount) {
          throw new Error(`Недостаточно средств. Доступно: ${fromBalance.toFixed(2)} ${fromCard.type.toUpperCase()}`);
        }

        const newFromBalance = (fromBalance - amount).toFixed(2);
        const newToBalance = (toBalance + amount).toFixed(2);

        // Создаём транзакцию
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

        // Обновляем балансы
        await this.updateCardBalance(fromCard.id, newFromBalance);
        await this.updateCardBalance(toCard.id, newToBalance);

        await client.query('COMMIT');
        return { success: true, transaction };

      } catch (error) {
        await client.query('ROLLBACK');
        return { 
          success: false, 
          error: error instanceof Error ? error.message : "Произошла ошибка при переводе" 
        };
      } finally {
        client.release();
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