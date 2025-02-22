import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { db } from "./db";
import { cards, users } from "@shared/schema";
import type { User, Card, InsertUser } from "@shared/schema";
import { eq } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

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
  getCardById(cardId: number): Promise<Card | undefined>;
  getCardByNumber(cardNumber: string): Promise<Card | undefined>;
  transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string }>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60,
      errorLog: console.error
    });
  }

  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`${context} failed (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);

        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`${context} failed after ${MAX_RETRIES} attempts`);
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
      // Remove any spaces or special characters from the card number for comparison
      const cleanCardNumber = cardNumber.replace(/\s+/g, '');
      const [card] = await db.select().from(cards).where(eq(cards.number, cleanCardNumber));
      console.log('Searching for card with number:', cleanCardNumber, 'Found:', card ? 'yes' : 'no');
      return card;
    }, 'Get card by number');
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string }> {
    return this.withRetry(async () => {
      console.log(`Attempting transfer: from card ${fromCardId} to card number ${toCardNumber}, amount: ${amount}`);

      // Clean the card number
      const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');

      const fromCard = await this.getCardById(fromCardId);
      if (!fromCard) {
        console.log('Source card not found');
        return { success: false, error: "Карта отправителя не найдена" };
      }

      const toCard = await this.getCardByNumber(cleanToCardNumber);
      if (!toCard) {
        console.log('Destination card not found for number:', cleanToCardNumber);
        return { success: false, error: "Карта получателя не найдена" };
      }

      // Prevent transfer to the same card
      if (fromCard.id === toCard.id) {
        return { success: false, error: "Нельзя перевести деньги на ту же карту" };
      }

      console.log('Found both cards:', { fromCard: fromCard.id, toCard: toCard.id });

      const fromBalance = parseFloat(fromCard.balance);
      if (isNaN(fromBalance) || fromBalance < amount) {
        return { success: false, error: "Недостаточно средств" };
      }

      const toBalance = parseFloat(toCard.balance);
      if (isNaN(toBalance)) {
        return { success: false, error: "Ошибка в балансе получателя" };
      }

      const newFromBalance = (fromBalance - amount).toFixed(2);
      const newToBalance = (toBalance + amount).toFixed(2);

      console.log('Updating balances:', {
        fromCard: { old: fromBalance, new: newFromBalance },
        toCard: { old: toBalance, new: newToBalance }
      });

      await db.transaction(async (tx) => {
        await tx.update(cards)
          .set({ balance: newFromBalance })
          .where(eq(cards.id, fromCard.id));
        await tx.update(cards)
          .set({ balance: newToBalance })
          .where(eq(cards.id, toCard.id));
      });

      console.log('Transfer completed successfully');
      return { success: true };
    }, 'Transfer money');
  }
}

export const storage = new DatabaseStorage();