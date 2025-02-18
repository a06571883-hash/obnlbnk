import { User, Card, InsertUser } from "@shared/schema";
import session from "express-session";
import pkg from "pg";
const { Pool } = pkg;
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { users, cards } from "@shared/schema";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCardsByUserId(userId: number): Promise<Card[]>;
  createCard(card: Omit<Card, "id">): Promise<Card>;
  sessionStore: session.Store;
  getAllUsers: () => Promise<User[]>; // Added
  updateRegulatorBalance: (userId: number, balance: string) => Promise<void>; // Added
  // Add methods for regulator to view user data and manage balances with 1% commission.  This is a placeholder.
  // ... additional methods needed for regulator functionality ...
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getCardsByUserId(userId: number): Promise<Card[]> {
    return await db.select().from(cards).where(eq(cards.userId, userId));
  }

  async createCard(card: Omit<Card, "id">): Promise<Card> {
    const result = await db.insert(cards).values(card).returning();
    return result[0];
  }

  async updateCardBalance(cardId: number, balance: string): Promise<void> {
    await db.update(cards)
      .set({ balance })
      .where(eq(cards.id, cardId));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateRegulatorBalance(userId: number, balance: string): Promise<void> {
    await db.update(users)
      .set({ regulatorBalance: balance })
      .where(eq(users.id, userId));
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      const fromCard = (await db.select().from(cards).where(eq(cards.id, fromCardId)))[0];
      const toCard = (await db.select().from(cards).where(eq(cards.number, toCardNumber)))[0];

      if (!fromCard || !toCard) {
        return { success: false, error: "Карта не найдена" };
      }

      if (parseFloat(fromCard.balance) < amount) {
        return { success: false, error: "Недостаточно средств" };
      }

      const newFromBalance = (parseFloat(fromCard.balance) - amount).toString();
      const newToBalance = (parseFloat(toCard.balance) + amount).toString();

      await db.update(cards)
        .set({ balance: newFromBalance })
        .where(eq(cards.id, fromCard.id));

      await db.update(cards)
        .set({ balance: newToBalance })
        .where(eq(cards.id, toCard.id));

      return { success: true };
    } catch (error) {
      console.error("Transfer error:", error);
      return { success: false, error: "Ошибка при переводе" };
    }
  }
}

export const storage = new DatabaseStorage();