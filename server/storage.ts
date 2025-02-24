import { Pool } from 'pg';
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { db } from "./db";
import { cards, users, transactions, exchangeRates } from "@shared/schema";
import type { User, Card, InsertUser, Transaction, ExchangeRate, NFTCollection, NFT, InsertNFT } from "@shared/schema";
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
  transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
  transferCrypto(fromCardId: number, recipientAddress: string, amount: number, cryptoType: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
  getLatestExchangeRates(): Promise<ExchangeRate | undefined>;
  updateExchangeRates(rates: { usdToUah: number; btcToUsd: number; ethToUsd: number }): Promise<ExchangeRate>;
  // NFT methods
  createNFTCollection(userId: number, name: string, description: string): Promise<NFTCollection>;
  createNFT(data: Omit<InsertNFT, "id">): Promise<NFT>;
  getNFTsByUserId(userId: number): Promise<NFT[]>;
  getNFTCollectionsByUserId(userId: number): Promise<NFTCollection[]>;
  canGenerateNFT(userId: number): Promise<boolean>;
  updateUserNFTGeneration(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: pool as any,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60,
      ttl: 30 * 24 * 60 * 60 // 30 days in seconds
    });

    this.sessionStore.on('error', (error) => {
      console.error('Session store error:', error);
    });

    this.sessionStore.on('connect', () => {
      console.log('Session store connected successfully');
    });
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
        wallet: transaction.wallet || null,
        description: transaction.description || "",
        createdAt: new Date()
      }).returning();
      return result;
    }, 'Create transaction');
  }

  private async createExchangeTransaction(
    fromCard: Card,
    toCard: Card,
    amount: number,
    convertedAmount: number,
    commission: number,
    btcCommission: number,
    regulator: User
  ): Promise<Transaction> {
    // Создаем транзакцию обмена
    const transaction = await this.createTransaction({
      fromCardId: fromCard.id,
      toCardId: toCard.id,
      amount: amount.toString(),
      convertedAmount: convertedAmount.toString(),
      type: 'exchange',
      status: 'completed',
      wallet: null,
      description: `Обмен ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} → ${convertedAmount.toFixed(2)} ${toCard.type.toUpperCase()}`,
      fromCardNumber: fromCard.number,
      toCardNumber: toCard.number,
      createdAt: new Date()
    });

    // Создаем транзакцию комиссии
    await this.createTransaction({
      fromCardId: fromCard.id,
      toCardId: regulator.id,
      amount: commission.toString(),
      convertedAmount: btcCommission.toString(),
      type: 'commission',
      status: 'completed',
      wallet: null,
      description: `💰 Комиссия за обмен ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} (${btcCommission.toFixed(8)} BTC)`,
      fromCardNumber: fromCard.number,
      toCardNumber: "REGULATOR",
      createdAt: new Date()
    });

    return transaction;
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    const conn = await db.transaction();

    try {
      const fromCard = await conn.query.cards.findFirst({
        where: eq(cards.id, fromCardId)
      });

      if (!fromCard) {
        await conn.rollback();
        return { success: false, error: "Карта отправителя не найдена" };
      }

      const toCard = await conn.query.cards.findFirst({
        where: eq(cards.number, toCardNumber)
      });

      if (!toCard) {
        await conn.rollback();
        return { success: false, error: "Карта получателя не найдена" };
      }

      // Convert amount to numbers and check balance
      const fromBalance = parseFloat(fromCard.balance);
      const toBalance = parseFloat(toCard.balance);

      if (fromBalance < amount) {
        await conn.rollback();
        return { success: false, error: "Недостаточно средств" };
      }

      // Perform transfer
      await conn.update(cards)
        .set({ balance: (fromBalance - amount).toFixed(2) })
        .where(eq(cards.id, fromCardId));

      await conn.update(cards)
        .set({ balance: (toBalance + amount).toFixed(2) })
        .where(eq(cards.id, toCard.id));

      // Create transaction record
      const [transaction] = await conn.insert(transactions)
        .values({
          fromCardId: fromCardId,
          toCardId: toCard.id,
          amount: amount.toFixed(2),
          type: 'transfer',
          status: 'completed',
          fromCardNumber: fromCard.number,
          toCardNumber: toCard.number,
          convertedAmount: amount.toFixed(2),
          description: `Перевод с карты ${fromCard.number} на карту ${toCard.number}`,
          createdAt: new Date()
        })
        .returning();

      await conn.commit();
      return { success: true, transaction };
    } catch (error) {
      await conn.rollback();
      console.error("Transfer error:", error);
      return { success: false, error: "Ошибка при переводе средств" };
    }
  }

  async transferCrypto(fromCardId: number, recipientAddress: string, amount: number, cryptoType: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withTransaction(async () => {
      try {
        const fromCard = await this.getCardById(fromCardId);
        if (!fromCard) {
          throw new Error("Карта отправителя не найдена");
        }

        // Get regulator for commission
        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (!regulator) {
          throw new Error("Регулятор не найден в системе");
        }

        // Check recipient's card if it's an internal transfer
        let toCard = null;
        const allCards = await db.select().from(cards);
        toCard = allCards.find(card =>
          card.btcAddress === recipientAddress ||
          card.ethAddress === recipientAddress
        );

        const balance = cryptoType === 'btc' ?
          parseFloat(fromCard.btcBalance || '0') :
          parseFloat(fromCard.ethBalance || '0');

        if (isNaN(balance)) {
          throw new Error("Ошибка формата баланса");
        }

        // Calculate commission (1%)
        const commission = amount * 0.01;
        const totalDeduction = amount + commission;

        if (balance < totalDeduction) {
          throw new Error(`Недостаточно ${cryptoType.toUpperCase()} на балансе (${balance} ${cryptoType.toUpperCase()}) с учетом комиссии 1%`);
        }

        // Get latest exchange rates for conversion
        const rates = await this.getLatestExchangeRates();
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        // Convert commission to BTC if needed
        let btcCommission = commission;
        if (cryptoType === 'eth') {
          const ethToUsd = parseFloat(rates.ethToUsd);
          const btcToUsd = parseFloat(rates.btcToUsd);
          btcCommission = (commission * ethToUsd) / btcToUsd;
        }

        // Update sender's balance
        const newSenderBalance = (balance - totalDeduction).toFixed(8);
        if (cryptoType === 'btc') {
          await this.updateCardBtcBalance(fromCard.id, newSenderBalance);
        } else {
          await this.updateCardEthBalance(fromCard.id, newSenderBalance);
        }

        // Update regulator's BTC balance
        const newRegulatorBtcBalance = (parseFloat(regulator.regulator_balance || '0') + btcCommission).toFixed(8);
        await this.updateRegulatorBalance(regulator.id, newRegulatorBtcBalance);

        // If internal transfer, update recipient's balance
        if (toCard) {
          const recipientBalance = cryptoType === 'btc' ?
            parseFloat(toCard.btcBalance || '0') :
            parseFloat(toCard.ethBalance || '0');

          const newRecipientBalance = (recipientBalance + amount).toFixed(8);

          if (cryptoType === 'btc') {
            await this.updateCardBtcBalance(toCard.id, newRecipientBalance);
          } else {
            await this.updateCardEthBalance(toCard.id, newRecipientBalance);
          }
        }

        // Create main transaction
        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: toCard?.id || fromCard.id,
          amount: amount.toString(),
          convertedAmount: amount.toString(),
          type: 'transfer',
          status: 'completed',
          wallet: recipientAddress,
          description: `Перевод ${amount.toFixed(8)} ${cryptoType.toUpperCase()} ${toCard ? 'на карту' : 'на адрес'} ${recipientAddress}`,
          fromCardNumber: fromCard.number,
          toCardNumber: toCard?.number || fromCard.number,
          createdAt: new Date()
        });

        // Create commission transaction
        await this.createCommissionTransaction(fromCard, toCard, commission, btcCommission, regulator);

        return { success: true, transaction };

      } catch (error) {
        console.error("Error in transferCrypto:", error);
        return { success: false, error: (error as Error).message };
      }
    }, 'Transfer crypto');
  }

  private async createCommissionTransaction(
    fromCard: Card,
    toCard: Card | null,
    commission: number,
    btcCommission: number,
    regulator: User
  ): Promise<Transaction> {
    return await this.createTransaction({
      fromCardId: fromCard.id,
      toCardId: regulator.id,
      amount: commission.toString(),
      convertedAmount: btcCommission.toString(),
      type: 'commission',
      status: 'completed',
      wallet: null,
      description: `Комиссия 1% от перевода с карты ${fromCard.number} ${toCard ? `на карту ${toCard.number}` : ''} (${btcCommission.toFixed(8)} BTC)`,
      fromCardNumber: fromCard.number,
      toCardNumber: "REGULATOR",
      createdAt: new Date()
    });
  }

  private async withTransaction<T>(operation: () => Promise<T>, context: string): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`${context} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, context: string, maxAttempts = 3): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`${context} failed (attempt ${attempt + 1}/${maxAttempts}):`, error);
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastError || new Error(`${context} failed after ${maxAttempts} attempts`);
  }

  async getLatestExchangeRates(): Promise<ExchangeRate | undefined> {
    return this.withRetry(async () => {
      const [rates] = await db
        .select()
        .from(exchangeRates)
        .orderBy(desc(exchangeRates.updatedAt))
        .limit(1);
      return rates;
    }, 'Get latest exchange rates');
  }

  async updateExchangeRates(rates: { usdToUah: number; btcToUsd: number; ethToUsd: number }): Promise<ExchangeRate> {
    return this.withRetry(async () => {
      const [result] = await db
        .insert(exchangeRates)
        .values({
          usdToUah: rates.usdToUah.toString(),
          btcToUsd: rates.btcToUsd.toString(),
          ethToUsd: rates.ethToUsd.toString(),
          updatedAt: new Date()
        })
        .returning();
      return result;
    }, 'Update exchange rates');
  }


}

export const storage = new DatabaseStorage();