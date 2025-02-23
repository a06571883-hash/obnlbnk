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

// Exchange rates - using current market rates
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
  transferMoney(fromCardId: number, toCardNumber: string, usdAmount: number, wallet?: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
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

  async transferMoney(fromCardId: number, toCardNumber: string, usdAmount: number, wallet?: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withRetry(async () => {
      console.log(`Starting transfer: fromCardId=${fromCardId}, toCardNumber=${toCardNumber}, usdAmount=${usdAmount}, wallet=${wallet}`);

      if (usdAmount <= 0) {
        return { success: false, error: "Сумма перевода должна быть больше 0" };
      }

      const fromCard = await this.getCardById(fromCardId);
      if (!fromCard) {
        return { success: false, error: "Карта отправителя не найдена" };
      }

      // Different logic for crypto and regular transfers
      let toCard;
      if (wallet) {
        // For crypto transfers, find card by BTC or ETH address
        const allCards = await db.select().from(cards);
        toCard = allCards.find(card =>
          (wallet === 'btc' && card.btcAddress === toCardNumber) ||
          (wallet === 'eth' && card.ethAddress === toCardNumber)
        );
      } else {
        // For regular transfers, find by card number
        const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
        [toCard] = await db.select().from(cards).where(eq(cards.number, cleanToCardNumber));
      }

      if (!toCard) {
        return { success: false, error: "Карта получателя не найдена" };
      }

      if (fromCard.id === toCard.id) {
        return { success: false, error: "Нельзя перевести деньги на ту же карту" };
      }

      // Handle USD to crypto transfer
      if (fromCard.type === 'usd' && toCard.type === 'crypto' && wallet) {
        const rate = wallet === 'btc' ? EXCHANGE_RATES.btcToUsd : EXCHANGE_RATES.ethToUsd;
        const cryptoAmount = Number((usdAmount / rate).toFixed(8));
        const fromBalance = Number(fromCard.balance);

        console.log('Transfer details:', {
          type: 'usd_to_crypto',
          wallet,
          usdAmount,
          rate,
          cryptoAmount,
          fromBalance
        });

        if (fromBalance < usdAmount) {
          return { success: false, error: `Недостаточно USD для перевода. Требуется: ${usdAmount} USD, Доступно: ${fromBalance} USD` };
        }

        const newFromBalance = (fromBalance - usdAmount).toFixed(2);
        const newToBalance = wallet === 'btc'
          ? (Number(toCard.btcBalance) + cryptoAmount).toFixed(8)
          : (Number(toCard.ethBalance) + cryptoAmount).toFixed(8);

        console.log('New balances:', {
          from: { old: fromBalance, new: newFromBalance, currency: 'USD' },
          to: { old: wallet === 'btc' ? toCard.btcBalance : toCard.ethBalance, new: newToBalance, currency: wallet.toUpperCase() }
        });

        // Execute transaction in database
        const transaction = await db.transaction(async (tx) => {
          // Create transaction record
          const [newTransaction] = await tx.insert(transactions)
            .values({
              fromCardId: fromCard.id,
              toCardId: toCard.id,
              amount: usdAmount.toString(),
              convertedAmount: cryptoAmount.toString(),
              type: 'transfer',
              wallet: wallet,
              status: 'completed',
              description: `Convert ${usdAmount} USD to ${cryptoAmount} ${wallet.toUpperCase()}`,
              fromCardNumber: fromCard.number,
              toCardNumber: toCard.number
            })
            .returning();

          // Update USD balance
          await tx.update(cards)
            .set({ balance: newFromBalance })
            .where(eq(cards.id, fromCard.id));

          // Update crypto balance
          if (wallet === 'btc') {
            await tx.update(cards)
              .set({ btcBalance: newToBalance })
              .where(eq(cards.id, toCard.id));
          } else {
            await tx.update(cards)
              .set({ ethBalance: newToBalance })
              .where(eq(cards.id, toCard.id));
          }

          return newTransaction;
        });

        console.log('Transfer completed successfully:', transaction);
        return { success: true, transaction };
      }

      // Handle crypto (BTC/ETH) to USD transfer
      if (fromCard.type === 'crypto' && wallet && toCard.type === 'usd') {
        const rate = wallet === 'btc' ? EXCHANGE_RATES.btcToUsd : EXCHANGE_RATES.ethToUsd;
        const cryptoAmount = Number((usdAmount / rate).toFixed(8));
        const fromBalance = Number(wallet === 'btc' ? fromCard.btcBalance : fromCard.ethBalance);
        const toBalance = Number(toCard.balance);

        console.log('Transfer details:', {
          type: 'crypto_to_usd',
          wallet,
          usdAmount,
          rate,
          cryptoAmount,
          fromBalance,
          toBalance
        });

        if (fromBalance < cryptoAmount) {
          const message = `Недостаточно ${wallet.toUpperCase()} для перевода ${usdAmount} USD. ` +
            `Требуется: ${cryptoAmount} ${wallet.toUpperCase()}, ` +
            `Доступно: ${fromBalance} ${wallet.toUpperCase()}`;
          return { success: false, error: message };
        }

        const newFromBalance = (fromBalance - cryptoAmount).toFixed(8);
        const newToBalance = (toBalance + usdAmount).toFixed(2);

        console.log('New balances:', {
          from: { old: fromBalance, new: newFromBalance, currency: wallet.toUpperCase() },
          to: { old: toBalance, new: newToBalance, currency: 'USD' }
        });

        // Execute transaction in database
        const transaction = await db.transaction(async (tx) => {
          // Create transaction record
          const [newTransaction] = await tx.insert(transactions)
            .values({
              fromCardId: fromCard.id,
              toCardId: toCard.id,
              amount: cryptoAmount.toString(),
              convertedAmount: usdAmount.toString(),
              type: 'transfer',
              wallet: wallet,
              status: 'completed',
              description: `Convert ${cryptoAmount} ${wallet.toUpperCase()} to ${usdAmount} USD`,
              fromCardNumber: fromCard.number,
              toCardNumber: toCard.number
            })
            .returning();

          // Update crypto balance
          if (wallet === 'btc') {
            await tx.update(cards)
              .set({ btcBalance: newFromBalance })
              .where(eq(cards.id, fromCard.id));
          } else {
            await tx.update(cards)
              .set({ ethBalance: newFromBalance })
              .where(eq(cards.id, fromCard.id));
          }

          // Update USD balance
          await tx.update(cards)
            .set({ balance: newToBalance })
            .where(eq(cards.id, toCard.id));

          return newTransaction;
        });

        console.log('Transfer completed successfully:', transaction);
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