import { Pool } from 'pg';
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { db } from "./db";
import { cards, users, transactions, exchangeRates, nftCollections, nfts } from "@shared/schema";
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
    return this.withTransaction(async () => {
      try {
        const fromCard = await this.getCardById(fromCardId);
        if (!fromCard) {
          throw new Error("Карта отправителя не найдена");
        }

        const toCard = await this.getCardByNumber(toCardNumber);
        if (!toCard) {
          throw new Error("Карта получателя не найдена");
        }

        // Get regulator user for commission
        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (!regulator) {
          throw new Error("Регулятор не найден в системе");
        }

        // Get latest exchange rates
        const rates = await this.getLatestExchangeRates();
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        // Parse balances
        const fromBalanceStr = fromCard.balance;
        const fromBalance = parseFloat(fromBalanceStr);

        if (isNaN(fromBalance)) {
          throw new Error("Ошибка формата баланса");
        }

        // Calculate commission (1%)
        const commission = amount * 0.01;
        const totalDeduction = amount + commission;

        if (fromBalance < totalDeduction) {
          throw new Error(`Недостаточно средств на балансе (${fromBalance.toFixed(2)} ${fromCard.type.toUpperCase()}) с учетом комиссии 1%`);
        }

        // Calculate conversion rates based on latest exchange rates
        type CurrencyType = 'usd' | 'uah' | 'crypto';

        const conversionRates: Record<CurrencyType, Record<'usd' | 'uah' | 'crypto', number>> = {
          usd: {
            usd: 1,
            uah: parseFloat(rates.usdToUah),
            crypto: 1 / parseFloat(rates.btcToUsd)
          },
          uah: {
            usd: 1 / parseFloat(rates.usdToUah),
            uah: 1,
            crypto: 1 / (parseFloat(rates.btcToUsd) * parseFloat(rates.usdToUah))
          },
          crypto: {
            usd: parseFloat(rates.btcToUsd),
            uah: parseFloat(rates.btcToUsd) * parseFloat(rates.usdToUah),
            crypto: 1
          }
        };

        // Calculate converted amount for recipient
        let convertedAmount = amount;
        if (fromCard.type !== toCard.type) {
          const fromType = fromCard.type.toLowerCase() as CurrencyType;
          const toType = toCard.type.toLowerCase() as CurrencyType;
          convertedAmount = amount * conversionRates[fromType][toType];
        }

        // Convert commission to BTC
        let btcCommission = commission;
        if (fromCard.type !== 'crypto') {
          const fromType = fromCard.type.toLowerCase() as CurrencyType;
          btcCommission = commission * conversionRates[fromType]['crypto'];
        }

        // Update balances
        const newFromBalance = (fromBalance - totalDeduction).toFixed(2);
        const newToBalance = (parseFloat(toCard.balance) + convertedAmount).toFixed(2);
        const newRegulatorBtcBalance = (parseFloat(regulator.regulator_balance || '0') + btcCommission).toFixed(8);

        // Check if cards belong to the same user
        if (fromCard.userId === toCard.userId) {
          // Create exchange transaction
          const transaction = await this.createExchangeTransaction(
            fromCard,
            toCard,
            amount,
            convertedAmount,
            commission,
            btcCommission,
            regulator
          );

          // Update balances
          await this.updateCardBalance(fromCard.id, newFromBalance);
          await this.updateCardBalance(toCard.id, newToBalance);
          await this.updateRegulatorBalance(regulator.id, newRegulatorBtcBalance);

          return { success: true, transaction };
        } else {
          // Create transfer transaction
          const transaction = await this.createTransaction({
            fromCardId: fromCard.id,
            toCardId: toCard.id,
            amount: amount.toString(),
            convertedAmount: convertedAmount.toString(),
            type: 'transfer',
            status: 'completed',
            wallet: null,
            description: `💸 Перевод ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} → ${convertedAmount.toFixed(2)} ${toCard.type.toUpperCase()}`,
            fromCardNumber: fromCard.number,
            toCardNumber: toCard.number,
            createdAt: new Date()
          });

          // Create commission transaction
          await this.createTransaction({
            fromCardId: fromCard.id,
            toCardId: regulator.id,
            amount: commission.toString(),
            convertedAmount: btcCommission.toString(),
            type: 'commission',
            status: 'completed',
            wallet: null,
            description: `💰 Комиссия за перевод ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} (${btcCommission.toFixed(8)} BTC)`,
            fromCardNumber: fromCard.number,
            toCardNumber: "REGULATOR",
            createdAt: new Date()
          });

          // Update balances
          await this.updateCardBalance(fromCard.id, newFromBalance);
          await this.updateCardBalance(toCard.id, newToBalance);
          await this.updateRegulatorBalance(regulator.id, newRegulatorBtcBalance);

          return { success: true, transaction };
        }

      } catch (error) {
        console.error("Error in transferMoney:", error);
        return { success: false, error: (error as Error).message };
      }
    }, 'Transfer money');
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

  async createNFTCollection(userId: number, name: string, description: string): Promise<NFTCollection> {
    return this.withRetry(async () => {
      const [collection] = await db.insert(nftCollections).values({
        userId,
        name,
        description,
        createdAt: new Date()
      }).returning();
      return collection;
    }, 'Create NFT collection');
  }

  async createNFT(data: Omit<InsertNFT, "id">): Promise<NFT> {
    return this.withRetry(async () => {
      const [nft] = await db.insert(nfts).values({
        ...data,
        createdAt: new Date()
      }).returning();
      return nft;
    }, 'Create NFT');
  }

  async getNFTsByUserId(userId: number): Promise<NFT[]> {
    return this.withRetry(async () => {
      return await db.select().from(nfts).where(eq(nfts.userId, userId));
    }, 'Get NFTs by user ID');
  }

  async getNFTCollectionsByUserId(userId: number): Promise<NFTCollection[]> {
    return this.withRetry(async () => {
      return await db.select().from(nftCollections).where(eq(nftCollections.userId, userId));
    }, 'Get NFT collections by user ID');
  }

  async canGenerateNFT(userId: number): Promise<boolean> {
    return this.withRetry(async () => {
      const user = await this.getUser(userId);
      if (!user) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!user.last_nft_generation || user.last_nft_generation < today) {
        return true;
      }

      return user.nft_generation_count < 2;
    }, 'Check NFT generation limit');
  }

  async updateUserNFTGeneration(userId: number): Promise<void> {
    await this.withRetry(async () => {
      const user = await this.getUser(userId);
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!user.last_nft_generation || user.last_nft_generation < today) {
        await db.update(users)
          .set({
            last_nft_generation: new Date(),
            nft_generation_count: 1
          })
          .where(eq(users.id, userId));
      } else {
        await db.update(users)
          .set({
            nft_generation_count: user.nft_generation_count + 1
          })
          .where(eq(users.id, userId));
      }
    }, 'Update NFT generation count');
  }
}

export const storage = new DatabaseStorage();