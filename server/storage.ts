import { Pool } from 'pg';
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { db } from "./db";
import { cards, users, transactions, exchangeRates } from "@shared/schema";
import type { User, Card, InsertUser, Transaction, ExchangeRate } from "@shared/schema";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { generateValidAddress } from './routes'; // Added import for address generation

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
  createDefaultCardsForUser(userId: number): Promise<void>; // Added function declaration
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
      // Get the maximum existing ID to avoid conflicts
      const [maxIdResult] = await db.select({ maxId: sql`COALESCE(MAX(id), 0)` }).from(transactions);
      const nextId = Number(maxIdResult?.maxId || 0) + 1;

      const [result] = await db.insert(transactions).values({
        ...transaction,
        id: nextId,
        wallet: transaction.wallet || null,
        description: transaction.description || "",
        createdAt: new Date()
      }).returning();
      return result;
    }, 'Create transaction');
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withTransaction(async (client) => {
      try {
        // Блокируем карты отправителя
        const [fromCard] = await db.select().from(cards).where(eq(cards.id, fromCardId));
        if (!fromCard) {
          throw new Error("Карта отправителя не найдена");
        }

        // Получаем и блокируем карту получателя
        const cleanCardNumber = toCardNumber.replace(/\s+/g, '');
        const [toCard] = await db.select().from(cards).where(eq(cards.number, cleanCardNumber));
        if (!toCard) {
          throw new Error("Карта получателя не найдена");
        }

        // Получаем актуальные курсы валют
        const rates = await this.getLatestExchangeRates();
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        // Рассчитываем комиссию и конвертацию
        const commission = amount * 0.01;
        const totalDebit = amount + commission;

        // Проверяем достаточность средств
        if (fromCard.type === 'crypto') {
          const cryptoBalance = parseFloat(fromCard.btcBalance || '0');
          if (cryptoBalance < totalDebit) {
            throw new Error(`Недостаточно BTC. Доступно: ${cryptoBalance.toFixed(8)} BTC`);
          }
        } else {
          const fiatBalance = parseFloat(fromCard.balance);
          if (fiatBalance < totalDebit) {
            throw new Error(`Недостаточно средств. Доступно: ${fiatBalance.toFixed(2)} ${fromCard.type.toUpperCase()}`);
          }
        }

        // Рассчитываем сумму конвертации
        let convertedAmount = amount;
        if (fromCard.type !== toCard.type) {
          if (fromCard.type === 'usd' && toCard.type === 'uah') {
            convertedAmount = amount * parseFloat(rates.usdToUah);
            console.log(`Конвертация USD → UAH: ${amount} USD → ${convertedAmount.toFixed(2)} UAH (курс: 1 USD = ${rates.usdToUah} UAH)`);
          } else if (fromCard.type === 'uah' && toCard.type === 'usd') {
            convertedAmount = amount / parseFloat(rates.usdToUah);
            console.log(`Конвертация UAH → USD: ${amount} UAH → ${convertedAmount.toFixed(2)} USD (курс: 1 USD = ${rates.usdToUah} UAH)`);
          } else if ((fromCard.type === 'crypto' || fromCard.type === 'btc') && toCard.type === 'usd') {
            convertedAmount = amount * parseFloat(rates.btcToUsd);
            console.log(`Конвертация CRYPTO/BTC → USD: ${amount} BTC → ${convertedAmount.toFixed(2)} USD (курс: 1 BTC = $${rates.btcToUsd})`);
          } else if (fromCard.type === 'usd' && (toCard.type === 'crypto' || toCard.type === 'btc')) {
            convertedAmount = amount / parseFloat(rates.btcToUsd);
            console.log(`Конвертация USD → CRYPTO/BTC: ${amount} USD → ${convertedAmount.toFixed(8)} BTC (курс: 1 BTC = $${rates.btcToUsd})`);
          } else if (fromCard.type === 'btc' && toCard.type === 'uah') {
            const btcToUsd = amount * parseFloat(rates.btcToUsd);
            convertedAmount = btcToUsd * parseFloat(rates.usdToUah);
            console.log(`Конвертация BTC → UAH: ${amount} BTC → $${btcToUsd.toFixed(2)} USD → ${convertedAmount.toFixed(2)} UAH (курсы: 1 BTC = $${rates.btcToUsd}, 1 USD = ${rates.usdToUah} UAH)`);
          } else if (fromCard.type === 'eth' && toCard.type === 'uah') {
            const ethToUsd = amount * parseFloat(rates.ethToUsd);
            convertedAmount = ethToUsd * parseFloat(rates.usdToUah);
            console.log(`Конвертация ETH → UAH: ${amount} ETH → $${ethToUsd.toFixed(2)} USD → ${convertedAmount.toFixed(2)} UAH (курсы: 1 ETH = $${rates.ethToUsd}, 1 USD = ${rates.usdToUah} UAH)`);
          } else if (fromCard.type === 'crypto' && toCard.type === 'uah') {
            const btcToUsd = amount * parseFloat(rates.btcToUsd);
            convertedAmount = btcToUsd * parseFloat(rates.usdToUah);
            console.log(`Конвертация CRYPTO → UAH: ${amount} BTC → $${btcToUsd.toFixed(2)} USD → ${convertedAmount.toFixed(2)} UAH (курсы: 1 BTC = $${rates.btcToUsd}, 1 USD = ${rates.usdToUah} UAH)`);
          }
        }

        // Получаем регулятора для комиссии
        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (!regulator) {
          throw new Error("Регулятор не найден в системе");
        }

        // Выполняем перевод атомарно
        if (fromCard.type === 'crypto' || fromCard.type === 'btc') {
          const fromCryptoBalance = parseFloat(fromCard.btcBalance || '0');
          await db.update(cards)
            .set({ btcBalance: (fromCryptoBalance - totalDebit).toFixed(8) })
            .where(eq(cards.id, fromCard.id));

          console.log(`Списано с ${fromCard.type} карты: ${totalDebit.toFixed(8)} BTC, новый баланс: ${(fromCryptoBalance - totalDebit).toFixed(8)} BTC`);

          if (toCard.type === 'crypto' || toCard.type === 'btc') {
            const toCryptoBalance = parseFloat(toCard.btcBalance || '0');
            await db.update(cards)
              .set({ btcBalance: (toCryptoBalance + amount).toFixed(8) })
              .where(eq(cards.id, toCard.id));
            console.log(`Зачислено на ${toCard.type} карту: ${amount.toFixed(8)} BTC, новый баланс: ${(toCryptoBalance + amount).toFixed(8)} BTC`);
          } else {
            const toFiatBalance = parseFloat(toCard.balance);
            await db.update(cards)
              .set({ balance: (toFiatBalance + convertedAmount).toFixed(2) })
              .where(eq(cards.id, toCard.id));
            console.log(`Зачислено на ${toCard.type} карту: ${convertedAmount.toFixed(2)} ${toCard.type.toUpperCase()}, новый баланс: ${(toFiatBalance + convertedAmount).toFixed(2)} ${toCard.type.toUpperCase()}`);
          }
        } else {
          const fromFiatBalance = parseFloat(fromCard.balance);
          await db.update(cards)
            .set({ balance: (fromFiatBalance - totalDebit).toFixed(2) })
            .where(eq(cards.id, fromCard.id));

          if (toCard.type === 'crypto') {
            const toCryptoBalance = parseFloat(toCard.btcBalance || '0');
            await db.update(cards)
              .set({ btcBalance: (toCryptoBalance + convertedAmount).toFixed(8) })
              .where(eq(cards.id, toCard.id));
          } else {
            const toFiatBalance = parseFloat(toCard.balance);
            await db.update(cards)
              .set({ balance: (toFiatBalance + convertedAmount).toFixed(2) })
              .where(eq(cards.id, toCard.id));
          }
        }

        // Зачисляем комиссию регулятору
        const btcCommission = commission / parseFloat(rates.btcToUsd);
        const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
        await db.update(users)
          .set({ regulator_balance: (regulatorBtcBalance + btcCommission).toFixed(8) })
          .where(eq(users.id, regulator.id));

        // Создаем транзакцию перевода
        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: toCard.id,
          amount: amount.toString(),
          convertedAmount: convertedAmount.toString(),
          type: 'transfer',
          status: 'completed',
          description: fromCard.type === toCard.type ?
            `Перевод ${amount.toFixed(fromCard.type === 'crypto' || fromCard.type === 'btc' ? 8 : 2)} ${fromCard.type.toUpperCase()}` :
            `Перевод ${amount.toFixed(fromCard.type === 'crypto' || fromCard.type === 'btc' ? 8 : 2)} ${fromCard.type.toUpperCase()} → ${convertedAmount.toFixed(toCard.type === 'crypto' || toCard.type === 'btc' ? 8 : 2)} ${toCard.type.toUpperCase()} (курс: ${(convertedAmount / amount).toFixed(2)})`,
          fromCardNumber: fromCard.number,
          toCardNumber: toCard.number,
          wallet: null,
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
          description: `Комиссия за перевод (${btcCommission.toFixed(8)} BTC)`,
          fromCardNumber: fromCard.number,
          toCardNumber: "REGULATOR",
          wallet: null,
          createdAt: new Date()
        });

        return { success: true, transaction };
      } catch (error) {
        console.error("Transfer error:", error);
        throw error;
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

  private async withTransaction<T>(operation: (client: any) => Promise<T>, context: string): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
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

  // Создание стандартных карт для нового пользователя
  async createDefaultCardsForUser(userId: number): Promise<void> {
    try {
      console.log(`Creating default cards for user ${userId}`);

      // Генерируем адреса для крипто-карты
      const btcAddress = generateValidAddress('btc', userId);
      const ethAddress = generateValidAddress('eth', userId);

      console.log(`Generated addresses for user ${userId}:`, { btcAddress, ethAddress });

      // Функция для генерации случайного номера карты
      const generateCardNumber = (prefix: string) => {
        const suffix = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
        return `${prefix}${suffix}`;
      };

      // Генерируем дату истечения (текущий месяц + 3 года)
      const now = new Date();
      const expiryMonth = String(now.getMonth() + 1).padStart(2, '0');
      const expiryYear = String((now.getFullYear() + 3) % 100).padStart(2, '0');
      const expiry = `${expiryMonth}/${expiryYear}`;

      // Генерируем CVV
      const generateCVV = () => Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('');

      // Создаем крипто-карту
      const cryptoNumber = generateCardNumber('4532015112830');
      console.log(`Creating crypto card with number ${cryptoNumber} for user ${userId}`);

      await db.insert(cards).values({
        userId,
        type: 'crypto',
        number: cryptoNumber,
        expiry,
        cvv: generateCVV(),
        balance: "0.00000000",
        btcBalance: "0.00000000", // Changed: Set initial BTC balance to 0
        ethBalance: "0.00000000", // Changed: Set initial ETH balance to 0
        btcAddress,
        ethAddress
      });

      // Создаем USD карту
      const usdNumber = generateCardNumber('5375414128030');
      console.log(`Creating USD card with number ${usdNumber} for user ${userId}`);

      await db.insert(cards).values({
        userId,
        type: 'usd',
        number: usdNumber,
        expiry,
        cvv: generateCVV(),
        balance: "0.00000000", // Changed: Set initial USD balance to 0
        btcBalance: "0.00000000",
        ethBalance: "0.00000000",
        btcAddress: null,
        ethAddress: null
      });

      // Создаем UAH карту
      const uahNumber = generateCardNumber('4532015112836');
      console.log(`Creating UAH card with number ${uahNumber} for user ${userId}`);

      await db.insert(cards).values({
        userId,
        type: 'uah',
        number: uahNumber,
        expiry,
        cvv: generateCVV(),
        balance: "0.00000000", // Changed: Set initial UAH balance to 0
        btcBalance: "0.00000000",
        ethBalance: "0.00000000",
        btcAddress: null,
        ethAddress: null
      });

      console.log(`Created 3 default cards for user ${userId}`);
      return;
    } catch (error) {
      console.error(`Error creating default cards for user ${userId}:`, error);
      throw error;
    }
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