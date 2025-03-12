import session from "express-session";
import { db } from "./db";
import { cards, users, transactions, exchangeRates } from "@shared/schema";
import type { User, Card, InsertUser, Transaction, ExchangeRate } from "@shared/schema";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { generateValidAddress, validateCryptoAddress } from './utils/crypto';
import path from 'path';
import Database from 'better-sqlite3';

const SqliteStore = require('better-sqlite3-session-store')(session);

// Оптимизированная конфигурация для free tier
const sessionDb = new Database(':memory:', {
  readonly: false
});

sessionDb.pragma('journal_mode = WAL');
sessionDb.pragma('synchronous = NORMAL');
sessionDb.pragma('temp_store = MEMORY');
sessionDb.pragma('mmap_size = 30000000000');
sessionDb.pragma('page_size = 4096');

export const storage = new class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new SqliteStore({
      client: sessionDb,
      expired: {
        clear: true,
        intervalMs: 900000
      }
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
    return this.withTransaction(async () => {
      try {
        const [fromCard] = await db.select().from(cards).where(eq(cards.id, fromCardId));
        if (!fromCard) {
          throw new Error("Карта отправителя не найдена");
        }

        const cleanCardNumber = toCardNumber.replace(/\s+/g, '');
        const [toCard] = await db.select().from(cards).where(eq(cards.number, cleanCardNumber));
        if (!toCard) {
          throw new Error("Карта получателя не найдена");
        }

        const rates = await this.getLatestExchangeRates();
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        const commission = amount * 0.01;
        const totalDebit = amount + commission;

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

        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (!regulator) {
          throw new Error("Регулятор не найден в системе");
        }

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

        const btcCommission = commission / parseFloat(rates.btcToUsd);
        const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
        await db.update(users)
          .set({ regulator_balance: (regulatorBtcBalance + btcCommission).toFixed(8) })
          .where(eq(users.id, regulator.id));

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

        const toCard = await this.getCardByNumber(recipientAddress);
        console.log(`Поиск карты получателя по адресу ${recipientAddress}:`, toCard);

        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (!regulator) {
          throw new Error("Регулятор не найден в системе");
        }

        const commission = amount * 0.01;
        const totalDebit = amount + commission;

        let btcToSend: number;
        let btcCommission: number;

        if (fromCard.type === 'crypto') {
          btcToSend = amount;
          btcCommission = commission;

          const cryptoBalance = parseFloat(fromCard.btcBalance || '0');
          if (cryptoBalance < totalDebit) {
            throw new Error(
              `Недостаточно BTC. Доступно: ${cryptoBalance.toFixed(8)} BTC, ` +
              `требуется: ${amount.toFixed(8)} + ${commission.toFixed(8)} комиссия = ${totalDebit.toFixed(8)} BTC`
            );
          }

          await this.updateCardBtcBalance(fromCard.id, (cryptoBalance - totalDebit).toFixed(8));
          console.log(`Снято с отправителя: ${totalDebit.toFixed(8)} BTC`);

        } else {
          let usdAmount: number;

          if (fromCard.type === 'uah') {
            usdAmount = amount / parseFloat(rates.usdToUah);
          } else {
            usdAmount = amount;
          }

          btcToSend = usdAmount / parseFloat(rates.btcToUsd);
          btcCommission = (usdAmount * 0.01) / parseFloat(rates.btcToUsd);

          const fiatBalance = parseFloat(fromCard.balance);
          if (fiatBalance < totalDebit) {
            throw new Error(
              `Недостаточно средств. Доступно: ${fiatBalance.toFixed(2)} ${fromCard.type.toUpperCase()}, ` +
              `требуется: ${amount.toFixed(2)} + ${commission.toFixed(2)} комиссия = ${totalDebit.toFixed(2)} ${fromCard.type.toUpperCase()}`
            );
          }

          await this.updateCardBalance(fromCard.id, (fiatBalance - totalDebit).toFixed(2));
          console.log(`Снято с отправителя: ${totalDebit.toFixed(2)} ${fromCard.type.toUpperCase()}`);
        }

        if (toCard) {
          console.log(`Обнаружена внутренняя карта: ${toCard.id}, зачисляем средства`);
          const toCryptoBalance = parseFloat(toCard.btcBalance || '0');

          if (cryptoType === 'btc') {
            await this.updateCardBtcBalance(toCard.id, (toCryptoBalance + btcToSend).toFixed(8));
          } else {
            const ethToSend = btcToSend * (parseFloat(rates.btcToUsd) / parseFloat(rates.ethToUsd));
            const toEthBalance = parseFloat(toCard.ethBalance || '0');
            await this.updateCardEthBalance(toCard.id, (toEthBalance + ethToSend).toFixed(8));
          }

          console.log(`Обнуляем виртуальные балансы пользователя ${toCard.userId} после пополнения криптовалюты`);

          const userCards = await db.select()
            .from(cards)
            .where(eq(cards.userId, toCard.userId));

          for (const card of userCards) {
            if (card.type === 'usd' || card.type === 'uah') {
              await db.update(cards)
                .set({ balance: "0.00" })
                .where(eq(cards.id, card.id));
              console.log(`Обнулен баланс ${card.type} карты ${card.number}`);
            }
          }
        } else {
          if (!validateCryptoAddress(recipientAddress, cryptoType)) {
            throw new Error(`Недействительный ${cryptoType.toUpperCase()} адрес`);
          }
          console.log(`Адрес ${recipientAddress} валиден. Отправляем на внешний адрес...`);
        }

        const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
        await this.updateRegulatorBalance(
          regulator.id,
          (regulatorBtcBalance + btcCommission).toFixed(8)
        );

        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: toCard?.id || null,
          amount: fromCard.type === 'crypto' ? amount.toString() : amount.toString(),
          convertedAmount: (btcToSend).toString(),
          type: 'crypto_transfer',
          status: 'completed',
          description: fromCard.type === 'crypto'
            ? `Отправка ${amount.toFixed(8)} ${cryptoType.toUpperCase()} на ${recipientAddress}`
            : `Конвертация ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} → ${btcToSend.toFixed(8)} ${cryptoType.toUpperCase()} и отправка на ${recipientAddress}`,
          fromCardNumber: fromCard.number,
          toCardNumber: toCard?.number || "",
          wallet: recipientAddress,
          createdAt: new Date()
        });

        await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: regulator.id,
          amount: fromCard.type === 'crypto' ? commission.toString() : commission.toString(),
          convertedAmount: btcCommission.toString(),
          type: 'commission',
          status: 'completed',
          description: `Комиссия за перевод криптовалюты (${btcCommission.toFixed(8)} BTC)`,
          fromCardNumber: fromCard.number,
          toCardNumber: "REGULATOR",
          wallet: null,
          createdAt: new Date()
        });

        return { success: true, transaction };
      } catch (error) {
        console.error("Crypto transfer error:", error);
        throw error;
      }
    }, "Crypto Transfer Operation");
  }

  private async withTransaction<T>(operation: (client: any) => Promise<T>, context: string): Promise<T> {
    try {
      db.run(sql`PRAGMA journal_mode = WAL`);
      db.run(sql`BEGIN TRANSACTION`);

      const result = await operation(null);

      db.run(sql`COMMIT`);
      return result;
    } catch (error) {
      db.run(sql`ROLLBACK`);
      console.error(`${context} failed:`, error);
      throw error;
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, context: string, maxAttempts = 2): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`${context} failed (attempt ${attempt + 1}/${maxAttempts}):`, error);
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
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

  async createDefaultCardsForUser(userId: number): Promise<void> {
    try {
      console.log(`Starting default cards creation for user ${userId}`);

      let btcAddress: string, ethAddress: string;
      try {
        btcAddress = generateValidAddress('btc', userId);
        ethAddress = generateValidAddress('eth', userId);
        console.log('Generated crypto addresses:', { btcAddress, ethAddress });
      } catch (error) {
        console.error('Failed to generate valid crypto addresses:', error);
        throw new Error('Could not generate valid crypto addresses');
      }

      const now = new Date();
      const expiryMonth = String(now.getMonth() + 1).padStart(2, '0');
      const expiryYear = String((now.getFullYear() + 3) % 100).padStart(2, '0');
      const expiry = `${expiryMonth}/${expiryYear}`;

      const generateCVV = () => Math.floor(100 + Math.random() * 900).toString();

      try {
        console.log('Creating cards...');

        await this.withRetry(async () => {
          console.log('Creating crypto card...');
          const cryptoCardNumber = generateCardNumber('crypto');
          await db.insert(cards).values({
            userId,
            type: 'crypto',
            number: cryptoCardNumber,
            expiry,
            cvv: generateCVV(),
            balance: "0.00",
            btcBalance: "0.00000000",
            ethBalance: "0.00000000",
            btcAddress,
            ethAddress
          });
          console.log('Crypto card created successfully:', cryptoCardNumber);
        }, 'Create crypto card');

        await this.withRetry(async () => {
          console.log('Creating USD card...');
          const usdCardNumber = generateCardNumber('usd');
          await db.insert(cards).values({
            userId,
            type: 'usd',
            number: usdCardNumber,
            expiry,
            cvv: generateCVV(),
            balance: "0.00",
            btcBalance: "0.00000000",
            ethBalance: "0.00000000",
            btcAddress: null,
            ethAddress: null
          });
          console.log('USD card created successfully:', usdCardNumber);
        }, 'Create USD card');

        await this.withRetry(async () => {
          console.log('Creating UAH card...');
          const uahCardNumber = generateCardNumber('uah');
          await db.insert(cards).values({
            userId,
            type: 'uah',
            number: uahCardNumber,
            expiry,
            cvv: generateCVV(),
            balance: "0.00",
            btcBalance: "0.00000000",
            ethBalance: "0.00000000",
            btcAddress: null,
            ethAddress: null
          });
          console.log('UAH card created successfully:', uahCardNumber);
        }, 'Create UAH card');

        console.log(`All cards created successfully for user ${userId}`);
      } catch (error) {
        console.error(`Error creating cards for user ${userId}:`, error);
        throw error;
      }
    } catch (error) {
      console.error(`Error in createDefaultCardsForUser for user ${userId}:`, error);
      throw error;
    }
  }
  async deleteUser(userId: number): Promise<void> {
    return this.withTransaction(async () => {
      try {
        await db.delete(cards)
          .where(eq(cards.userId, userId));

        await db.delete(users)
          .where(eq(users.id, userId));

        console.log(`User ${userId} and their cards deleted successfully`);
      } catch (error) {
        console.error(`Error deleting user ${userId}:`, error);
        throw error;
      }
    }, 'Delete user');
  }
  async resetAllVirtualBalances(): Promise<void> {
    return this.withTransaction(async () => {
      try {
        console.log('Начинаем процесс обнуления всех балансов...');

        db.run(sql`UPDATE cards SET balance = '0.00', btcBalance = '0.00000000', ethBalance = '0.00000000'`);
        db.run(sql`UPDATE users SET regulator_balance = '0.00000000' WHERE is_regulator = 1`);

        console.log('Все балансы успешно обнулены');
      } catch (error) {
        console.error('Ошибка при обнулении балансов:', error);
        throw error;
      }
    }, 'Reset All Balances Operation');
  }
};

function generateCardNumber(type: 'crypto' | 'usd' | 'uah'): string {
  const prefixes = {
    crypto: '4111',
    usd: '4112',
    uah: '41113'
  };

  const suffix = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  return `${prefixes[type]}${suffix}`;
}

interface IStorage {
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
  createDefaultCardsForUser(userId: number): Promise<void>;
  deleteUser(userId: number): Promise<void>;
  resetAllVirtualBalances(): Promise<void>;
}