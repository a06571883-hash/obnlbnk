import session from "express-session";
import { db } from "./database/connection";
import { cards, users, transactions } from "@shared/schema";
import type { User, Card, InsertUser, Transaction } from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { pool } from "./database/connection";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, type User, type InsertUser } from "@shared/schema";
import { db as drizzleDb } from "./database/connection"; //Renamed to avoid conflict
import { eq as drizzleEq } from "drizzle-orm";
import postgres from 'postgres';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const PostgresSessionStore = connectPg(session);

// Create a separate connection pool for sessions
const sessionPool = postgres(process.env.DATABASE_URL!, {
  max: 10,
  ssl: false,
  connection: {
    application_name: "session_store"
  }
});

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
  getTransactionsByCardId(cardId: number): Promise<Transaction[]>;
  createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction>;
  transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: sessionPool,
      createTableIfMissing: true,
      tableName: 'session'
    });
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
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`${context} failed after 3 attempts`);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db.select().from(users).where(drizzleEq(users.id, id));
      return user;
    }, 'Get user');
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db.select().from(users).where(drizzleEq(users.username, username));
      return user;
    }, 'Get user by username');
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      // Hash the password before storing
      const hashedPassword = await hashPassword(insertUser.password);
      const [user] = await db.insert(users).values({
        ...insertUser,
        password: hashedPassword
      }).returning();
      return user;
    }, 'Create user');
  }

  async getCardsByUserId(userId: number): Promise<Card[]> {
    return this.withRetry(async () => {
      return await db.select().from(cards).where(drizzleEq(cards.userId, userId));
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
        .where(drizzleEq(users.id, userId));
    }, 'Update regulator balance');
  }

  async updateCardBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(cards)
        .set({ balance: balance })
        .where(drizzleEq(cards.id, cardId));
    }, 'Update card balance');
  }

  async getCardById(cardId: number): Promise<Card | undefined> {
    return this.withRetry(async () => {
      const [card] = await db.select().from(cards).where(drizzleEq(cards.id, cardId));
      return card;
    }, 'Get card by ID');
  }

  async getCardByNumber(cardNumber: string): Promise<Card | undefined> {
    return this.withRetry(async () => {
      const cleanCardNumber = cardNumber.replace(/\s+/g, '');
      const [card] = await db.select().from(cards).where(drizzleEq(cards.number, cleanCardNumber));
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
            drizzleEq(transactions.fromCardId, cardId),
            drizzleEq(transactions.toCardId, cardId)
          )
        )
        .orderBy(desc(transactions.createdAt));
    }, 'Get transactions by card ID');
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withRetry(async () => {
      console.log(`Attempting transfer: from card ${fromCardId} to card number ${toCardNumber}, amount: ${amount}`);

      // Clean card number
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

      let transaction: Transaction;

      // Use a transaction to ensure atomic updates
      await db.transaction(async (tx) => {
        // Create transaction record first
        const [newTransaction] = await tx.insert(transactions)
          .values({
            fromCardId: fromCard.id,
            toCardId: toCard.id,
            amount: amount.toString(),
            type: 'transfer',
            status: 'completed',
            description: `Transfer from card ${fromCard.number} to ${toCard.number}`
          })
          .returning();

        transaction = newTransaction;

        // Update card balances
        await tx.update(cards)
          .set({ balance: newFromBalance })
          .where(drizzleEq(cards.id, fromCard.id));

        await tx.update(cards)
          .set({ balance: newToBalance })
          .where(drizzleEq(cards.id, toCard.id));
      });

      console.log('Transfer completed successfully');
      return { success: true, transaction };
    }, 'Transfer money');
  }
  async createTransaction(transactionData: Omit<Transaction, "id">): Promise<Transaction> {
    return this.withRetry(async () => {
      console.log('Creating transaction:', transactionData);
      const [transaction] = await db.insert(transactions)
        .values({
          fromCardId: transactionData.fromCardId,
          toCardId: transactionData.toCardId,
          amount: transactionData.amount,
          convertedAmount: transactionData.convertedAmount || transactionData.amount,
          type: transactionData.type,
          status: transactionData.status,
          createdAt: new Date(),
          description: transactionData.description,
          fromCardNumber: transactionData.fromCardNumber,
          toCardNumber: transactionData.toCardNumber,
        })
        .returning();
      console.log('Transaction created:', transaction);
      return transaction;
    }, 'Create transaction');
  }
}

export const storage = new DatabaseStorage();