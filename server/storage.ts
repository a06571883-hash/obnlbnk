import { User, Card, InsertUser } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { users, cards } from "@shared/schema";
import { pool } from "./db";

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
  getAllUsers: () => Promise<User[]>;
  updateRegulatorBalance: (userId: number, balance: string) => Promise<void>;
  updateCardBalance: (cardId: number, balance: string) => Promise<void>;
  getCardById: (cardId: number) => Promise<Card | undefined>;
  transferMoney: (fromCardId: number, toCardNumber: string, amount: number) => Promise<{ success: boolean; error?: string }>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  private db: ReturnType<typeof drizzle>;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
    this.db = drizzle(pool);
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`Operation failed (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);

        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await this.db.select().from(users).where(eq(users.id, id));
      return user;
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await this.db.select().from(users).where(eq(users.username, username));
      return user;
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      const [user] = await this.db.insert(users).values(insertUser).returning();
      return user;
    });
  }

  async getCardsByUserId(userId: number): Promise<Card[]> {
    return this.withRetry(async () => {
      return await this.db.select().from(cards).where(eq(cards.userId, userId));
    });
  }

  async createCard(card: Omit<Card, "id">): Promise<Card> {
    return this.withRetry(async () => {
      const [result] = await this.db.insert(cards).values(card).returning();
      return result;
    });
  }

  async getAllUsers(): Promise<User[]> {
    return this.withRetry(async () => {
      return await this.db.select().from(users);
    });
  }

  async updateRegulatorBalance(userId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await this.db.update(users)
        .set({ regulator_balance: balance })
        .where(eq(users.id, userId));
    });
  }

  async updateCardBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await this.db.update(cards)
        .set({ balance: balance })
        .where(eq(cards.id, cardId));
    });
  }

  async getCardById(cardId: number): Promise<Card | undefined> {
    return this.withRetry(async () => {
      const [card] = await this.db.select().from(cards).where(eq(cards.id, cardId));
      return card;
    });
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string }> {
    return this.withRetry(async () => {
      const fromCard = await this.getCardById(fromCardId);
      const [toCard] = await this.db.select().from(cards).where(eq(cards.number, toCardNumber));

      if (!fromCard || !toCard) {
        return { success: false, error: "Карта не найдена" };
      }

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

      await this.db.transaction(async (tx) => {
        await tx.update(cards)
          .set({ balance: newFromBalance })
          .where(eq(cards.id, fromCard.id));

        await tx.update(cards)
          .set({ balance: newToBalance })
          .where(eq(cards.id, toCard.id));
      });

      return { success: true };
    });
  }
}

export const storage = new DatabaseStorage();