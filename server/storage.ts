import { Pool } from 'pg';
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { db } from "./db";
import { cards, users, transactions, exchangeRates } from "@shared/schema";
import type { User, Card, InsertUser, Transaction, ExchangeRate } from "@shared/schema";
import { eq, and, or, desc, inArray } from "drizzle-orm";

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
  createNFTCollection(userId: number, name: string, description: string): Promise<any>;
  createNFT(data: Omit<any, "id">): Promise<any>;
  getNFTsByUserId(userId: number): Promise<any[]>;
  getNFTCollectionsByUserId(userId: number): Promise<any[]>;
  canGenerateNFT(userId: number): Promise<boolean>;
  updateUserNFTGeneration(userId: number): Promise<void>;
  getTransactionsByCardIds(cardIds: number[]): Promise<Transaction[]>;
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
      console.log(`Updating card ${cardId} balance to ${balance}`);
      await db
        .update(cards)
        .set({ balance })
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
      console.log("Searching for card with number or BTC address:", cardNumber);
      const [card] = await db
        .select()
        .from(cards)
        .where(or(
          eq(cards.number, cardNumber),
          eq(cards.btcAddress, cardNumber)
        ));
      console.log("Found card:", card);
      return card;
    }, 'Get card by number or BTC address');
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

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withTransaction(async () => {
      try {
        const fromCard = await this.getCardById(fromCardId);
        if (!fromCard) {
          throw new Error("Карта отправителя не найдена");
        }

        const cleanCardNumber = toCardNumber.replace(/\s+/g, '');
        const toCard = await this.getCardByNumber(cleanCardNumber);
        if (!toCard) {
          throw new Error("Карта получателя не найдена");
        }

        const rates = await this.getLatestExchangeRates();
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        let convertedAmount = amount;

        // Calculate conversion based on card types
        if (fromCard.type !== toCard.type) {
          if (fromCard.type === 'usd' && toCard.type === 'uah') {
            convertedAmount = amount * parseFloat(rates.usdToUah);
          } else if (fromCard.type === 'uah' && toCard.type === 'usd') {
            convertedAmount = amount / parseFloat(rates.usdToUah);
          } else if (fromCard.type === 'crypto' && toCard.type === 'usd') {
            // Convert BTC to USD
            convertedAmount = amount * parseFloat(rates.btcToUsd);
          } else if (fromCard.type === 'usd' && toCard.type === 'crypto') {
            // Convert USD to BTC
            convertedAmount = amount / parseFloat(rates.btcToUsd);
          }
        }

        // Get regulator for commission
        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (!regulator) {
          throw new Error("Регулятор не найден в системе");
        }

        // Calculate commission
        const commission = amount * 0.01;
        const btcCommission = commission / parseFloat(rates.btcToUsd);

        // Check and update balances based on card types
        if (fromCard.type === 'crypto') {
          // Check crypto balance
          const cryptoBalance = parseFloat(fromCard.btcBalance || '0');
          if (cryptoBalance < (amount + commission)) {
            throw new Error(
              `Недостаточно BTC. Доступно: ${cryptoBalance.toFixed(8)} BTC, ` +
              `требуется: ${amount.toFixed(8)} + ${commission.toFixed(8)} комиссия = ${(amount + commission).toFixed(8)} BTC`
            );
          }

          // Update crypto balances
          await this.updateCardBtcBalance(fromCard.id, (cryptoBalance - amount - commission).toFixed(8));

          if (toCard.type === 'crypto') {
            // Crypto to crypto transfer
            const toCryptoBalance = parseFloat(toCard.btcBalance || '0');
            await this.updateCardBtcBalance(toCard.id, (toCryptoBalance + amount).toFixed(8));
          } else {
            // Crypto to fiat transfer
            const toBalance = parseFloat(toCard.balance);
            await this.updateCardBalance(toCard.id, (toBalance + convertedAmount).toFixed(2));
          }

        } else if (toCard.type === 'crypto') {
          // Check fiat balance
          const fiatBalance = parseFloat(fromCard.balance);
          if (fiatBalance < (amount + commission)) {
            throw new Error(
              `Недостаточно средств. Доступно: ${fiatBalance.toFixed(2)} ${fromCard.type.toUpperCase()}, ` +
              `требуется: ${amount.toFixed(2)} + ${commission.toFixed(2)} комиссия = ${(amount + commission).toFixed(2)} ${fromCard.type.toUpperCase()}`
            );
          }

          // Update balances for fiat to crypto
          await this.updateCardBalance(fromCard.id, (fiatBalance - amount - commission).toFixed(2));
          const toCryptoBalance = parseFloat(toCard.btcBalance || '0');
          await this.updateCardBtcBalance(toCard.id, (toCryptoBalance + convertedAmount).toFixed(8));

        } else {
          // Standard fiat transfer
          const fromBalance = parseFloat(fromCard.balance);
          if (fromBalance < (amount + commission)) {
            throw new Error(
              `Недостаточно средств. Доступно: ${fromBalance.toFixed(2)} ${fromCard.type.toUpperCase()}, ` +
              `требуется: ${amount.toFixed(2)} + ${commission.toFixed(2)} комиссия = ${(amount + commission).toFixed(2)} ${fromCard.type.toUpperCase()}`
            );
          }

          await this.updateCardBalance(fromCard.id, (fromBalance - amount - commission).toFixed(2));
          const toBalance = parseFloat(toCard.balance);
          await this.updateCardBalance(toCard.id, (toBalance + convertedAmount).toFixed(2));
        }

        // Update regulator's BTC balance with commission
        const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
        await this.updateRegulatorBalance(regulator.id, (regulatorBtcBalance + btcCommission).toFixed(8));

        // Create main transaction
        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: toCard.id,
          amount: amount.toString(),
          convertedAmount: convertedAmount.toString(),
          type: 'transfer',
          status: 'completed',
          description: fromCard.type === toCard.type ?
            `Перевод ${amount.toFixed(fromCard.type === 'crypto' ? 8 : 2)} ${fromCard.type.toUpperCase()}` :
            `Перевод ${amount.toFixed(fromCard.type === 'crypto' ? 8 : 2)} ${fromCard.type.toUpperCase()} → ${convertedAmount.toFixed(toCard.type === 'crypto' ? 8 : 2)} ${toCard.type.toUpperCase()}`,
          fromCardNumber: fromCard.number,
          toCardNumber: toCard.number,
          wallet: null,
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
          description: `Комиссия за перевод (${btcCommission.toFixed(8)} BTC)`,
          fromCardNumber: fromCard.number,
          toCardNumber: "REGULATOR",
          wallet: null,
          createdAt: new Date()
        });

        return { success: true, transaction };
      } catch (error) {
        console.error("Transfer error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Ошибка при выполнении перевода"
        };
      }
    }, "Transfer Money Operation");
  }

  async transferCrypto(fromCardId: number, recipientAddress: string, amount: number, cryptoType: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withTransaction(async () => {
      try {
        const fromCard = await this.getCardById(fromCardId);
        if (!fromCard) {
          throw new Error("Карта отправителя не найдена");
        }

        const rates = await this.getLatestExchangeRates();
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        // Найти карту получателя по BTC адресу
        const toCard = await this.getCardByNumber(recipientAddress);
        console.log(`Поиск карты получателя по адресу ${recipientAddress}:`, toCard);

        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (!regulator) {
          throw new Error("Регулятор не найден в системе");
        }

        // Calculate amounts
        const commission = amount * 0.01;
        const totalDebit = amount + commission;

        let btcToSend: number;
        let btcCommission: number;

        if (fromCard.type === 'crypto') {
          // Отправляем напрямую в BTC
          btcToSend = amount;
          btcCommission = commission;

          const cryptoBalance = parseFloat(fromCard.btcBalance || '0');
          if (cryptoBalance < totalDebit) {
            throw new Error(
              `Недостаточно BTC. Доступно: ${cryptoBalance.toFixed(8)} BTC, ` +
              `требуется: ${amount.toFixed(8)} + ${commission.toFixed(8)} комиссия = ${totalDebit.toFixed(8)} BTC`
            );
          }

          // Снимаем BTC с отправителя
          await this.updateCardBtcBalance(fromCard.id, (cryptoBalance - totalDebit).toFixed(8));
          console.log(`Снято с отправителя: ${totalDebit.toFixed(8)} BTC`);

        } else {
          // Конвертируем из фиатной валюты в BTC
          let usdAmount: number;

          // Сначала конвертируем в USD если нужно
          if (fromCard.type === 'uah') {
            usdAmount = amount / parseFloat(rates.usdToUah);
          } else {
            usdAmount = amount;
          }

          // Конвертируем USD в BTC
          btcToSend = usdAmount / parseFloat(rates.btcToUsd);
          btcCommission = (usdAmount * 0.01) / parseFloat(rates.btcToUsd);

          const fiatBalance = parseFloat(fromCard.balance);
          if (fiatBalance < totalDebit) {
            throw new Error(
              `Недостаточно средств. Доступно: ${fiatBalance.toFixed(2)} ${fromCard.type.toUpperCase()}, ` +
              `требуется: ${amount.toFixed(2)} + ${commission.toFixed(2)} комиссия = ${totalDebit.toFixed(2)} ${fromCard.type.toUpperCase()}`
            );
          }

          // Снимаем фиатные деньги с отправителя
          await this.updateCardBalance(fromCard.id, (fiatBalance - totalDebit).toFixed(2));
          console.log(`Снято с отправителя: ${totalDebit.toFixed(2)} ${fromCard.type}`);
        }

        // Если это перевод на карту - зачисляем BTC
        if (toCard) {
          const toCardCryptoBalance = parseFloat(toCard.btcBalance || '0');
          const newBalance = toCardCryptoBalance + btcToSend;
          await this.updateCardBtcBalance(toCard.id, newBalance.toFixed(8));
          console.log(`Зачислено получателю: ${btcToSend.toFixed(8)} BTC, новый баланс: ${newBalance.toFixed(8)} BTC`);
        }

        // Зачисляем комиссию регулятору
        const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
        await this.updateRegulatorBalance(regulator.id, (regulatorBtcBalance + btcCommission).toFixed(8));
        console.log(`Комиссия регулятору: ${btcCommission.toFixed(8)} BTC`);

        // Создаем транзакцию перевода
        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: toCard?.id || null,
          amount: amount.toString(),
          convertedAmount: btcToSend.toString(),
          type: 'transfer',
          status: 'completed',
          wallet: toCard ? null : recipientAddress,
          description: fromCard.type === 'crypto' ?
            `Перевод ${amount.toFixed(8)} BTC на адрес ${recipientAddress}` :
            `Перевод ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} (${btcToSend.toFixed(8)} BTC) на адрес ${recipientAddress}`,
          fromCardNumber: fromCard.number,
          toCardNumber: toCard?.number || "EXTERNAL",
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
          description: fromCard.type === 'crypto' ?
            `Комиссия за перевод (${commission.toFixed(8)} BTC)` :
            `Комиссия за перевод ${commission.toFixed(2)} ${fromCard.type.toUpperCase()} (${btcCommission.toFixed(8)} BTC)`,
          fromCardNumber: fromCard.number,
          toCardNumber: "REGULATOR",
          createdAt: new Date()
        });

        return { success: true, transaction };
      } catch (error) {
        console.error("Crypto transfer error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Ошибка при переводе криптовалюты"
        };
      }
    }, "Crypto Transfer Operation");
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


  async createNFTCollection(userId: number, name: string, description: string): Promise<any> {
    throw new Error("Method not implemented.");
  }
  async createNFT(data: Omit<any, "id">): Promise<any> {
    throw new Error("Method not implemented.");
  }
  async getNFTsByUserId(userId: number): Promise<any[]> {
    throw new Error("Method not implemented.");
  }
  async getNFTCollectionsByUserId(userId: number): Promise<any[]> {
    throw new Error("Method not implemented.");
  }
  async canGenerateNFT(userId: number): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  async updateUserNFTGeneration(userId: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async getTransactionsByCardIds(cardIds: number[]): Promise<Transaction[]> {
    return this.withRetry(async () => {
      return await db.select()
        .from(transactions)
        .where(or(
          inArray(transactions.fromCardId, cardIds),
          inArray(transactions.toCardId, cardIds)
        ))
        .orderBy(desc(transactions.createdAt));
    }, 'Get transactions by card IDs');
  }
}

export const storage = new DatabaseStorage();

// Add validation functions (replace with your actual validation logic)
function validateBtcAddress(address: string): boolean {
  // Implement BTC address validation here
  return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
}

function validateEthAddress(address: string): boolean {
  // Implement ETH address validation here
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}