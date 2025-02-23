import session from "express-session";
import { db } from "./db";
import { cards, users, transactions } from "@shared/schema";
import type { User, Card, InsertUser, Transaction } from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { pool } from "./db";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import pg from 'pg';

const scryptAsync = promisify(scrypt);

const PostgresSessionStore = connectPg(session);

// Create a proper connection pool for sessions using node-postgres
const sessionPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: false,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true
});

// Exchange rates
const EXCHANGE_RATES = {
  btcToUsd: 96252.05, // Current BTC/USD rate
  ethToUsd: 2950.00,  // Current ETH/USD rate
};

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
    console.log('Initializing DatabaseStorage with session store...');
    this.sessionStore = new PostgresSessionStore({
      pool: sessionPool,
      createTableIfMissing: true,
      tableName: 'session',
      pruneSessionInterval: 60,
      schemaName: 'public'
    });
    console.log('Session store initialized');
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

  async createTransaction(transactionData: Omit<Transaction, "id">): Promise<Transaction> {
    return this.withRetry(async () => {
      console.log('Creating transaction:', transactionData);
      const [transaction] = await db.insert(transactions)
        .values(transactionData)
        .returning();
      console.log('Transaction created:', transaction);
      return transaction;
    }, 'Create transaction');
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number, wallet?: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withRetry(async () => {
      console.log(`Attempting transfer: from card ${fromCardId} to ${toCardNumber}, amount: ${amount}, wallet: ${wallet}`);

      const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');

      const fromCard = await this.getCardById(fromCardId);
      if (!fromCard) {
        return { success: false, error: "Карта отправителя не найдена" };
      }

      const toCard = await this.getCardByNumber(cleanToCardNumber);
      if (!toCard) {
        return { success: false, error: "Карта получателя не найдена" };
      }

      if (fromCard.id === toCard.id) {
        return { success: false, error: "Нельзя перевести деньги на ту же карту" };
      }

      // Crypto to USD transfer
      if (fromCard.type === 'crypto' && wallet && toCard.type === 'usd') {
        const fromBalance = parseFloat(wallet === 'btc' ? fromCard.btcBalance : fromCard.ethBalance);
        const toBalance = parseFloat(toCard.balance);

        // User specified USD amount they want to receive
        const targetUsdAmount = amount;

        // Calculate required crypto amount based on current exchange rate
        const rate = wallet === 'btc' ? EXCHANGE_RATES.btcToUsd : EXCHANGE_RATES.ethToUsd;
        const requiredCryptoAmount = Number((targetUsdAmount / rate).toFixed(8));

        console.log('Transfer details:', {
          type: 'crypto_to_usd',
          wallet,
          targetUsdAmount,
          requiredCryptoAmount,
          rate,
          currentCryptoBalance: fromBalance
        });

        // Check if sender has enough crypto
        if (fromBalance < requiredCryptoAmount) {
          return { 
            success: false, 
            error: `Недостаточно ${wallet.toUpperCase()} для конвертации ${targetUsdAmount} USD. Требуется: ${requiredCryptoAmount} ${wallet.toUpperCase()}`
          };
        }

        // Calculate new balances
        const newFromCryptoBalance = (fromBalance - requiredCryptoAmount).toFixed(8);
        const newToUsdBalance = (toBalance + targetUsdAmount).toFixed(2);

        console.log('New balances:', {
          from: { old: fromBalance, new: newFromCryptoBalance, currency: wallet.toUpperCase() },
          to: { old: toBalance, new: newToUsdBalance, currency: 'USD' }
        });

        // Execute transaction in database
        const transaction = await db.transaction(async (tx) => {
          // Create transaction record
          const [newTransaction] = await tx.insert(transactions)
            .values({
              fromCardId: fromCard.id,
              toCardId: toCard.id,
              amount: requiredCryptoAmount.toString(),
              convertedAmount: targetUsdAmount.toString(),
              type: 'transfer',
              wallet: wallet,
              status: 'completed',
              description: `Transfer from ${fromCard.number} to ${toCard.number}`,
              fromCardNumber: fromCard.number,
              toCardNumber: toCard.number
            })
            .returning();

          // Update crypto balance
          if (wallet === 'btc') {
            await tx.update(cards)
              .set({ btcBalance: newFromCryptoBalance })
              .where(eq(cards.id, fromCard.id));
          } else {
            await tx.update(cards)
              .set({ ethBalance: newFromCryptoBalance })
              .where(eq(cards.id, fromCard.id));
          }

          // Update USD balance
          await tx.update(cards)
            .set({ balance: newToUsdBalance })
            .where(eq(cards.id, toCard.id));

          return newTransaction;
        });

        console.log('Transfer completed successfully');
        return { success: true, transaction };
      }

      return { success: false, error: "Неподдерживаемый тип перевода" };
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