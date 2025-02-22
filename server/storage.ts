import { User, Card, InsertUser } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { users, cards } from "@shared/schema";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

const db = drizzle(pool);

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

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0];
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username));
      return result[0];
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getCardsByUserId(userId: number): Promise<Card[]> {
    try {
      return await db.select().from(cards).where(eq(cards.userId, userId));
    } catch (error) {
      console.error('Error getting cards by user ID:', error);
      return [];
    }
  }

  async createCard(card: Omit<Card, "id">): Promise<Card> {
    const result = await db.insert(cards).values(card).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  async updateRegulatorBalance(userId: number, balance: string): Promise<void> {
    try {
      await db.update(users)
        .set({ regulator_balance: balance })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error('Error updating regulator balance:', error);
      throw error;
    }
  }

  async updateCardBalance(cardId: number, balance: string): Promise<void> {
    try {
      await db.update(cards)
        .set({ balance: balance })
        .where(eq(cards.id, cardId));
    } catch (error) {
      console.error('Error updating card balance:', error);
      throw error;
    }
  }

  async getCardById(cardId: number): Promise<Card | undefined> {
    try {
      const result = await db.select().from(cards).where(eq(cards.id, cardId));
      return result[0];
    } catch (error) {
      console.error('Error getting card by ID:', error);
      return undefined;
    }
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      const fromCard = await this.getCardById(fromCardId);
      const [toCard] = await db.select().from(cards).where(eq(cards.number, toCardNumber));

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

      await db.transaction(async (tx) => {
        await tx.update(cards)
          .set({ balance: newFromBalance })
          .where(eq(cards.id, fromCard.id));

        await tx.update(cards)
          .set({ balance: newToBalance })
          .where(eq(cards.id, toCard.id));
      });

      return { success: true };
    } catch (error) {
      console.error("Transfer error:", error);
      return { success: false, error: "Ошибка при переводе" };
    }
  }
}

export const storage = new DatabaseStorage();