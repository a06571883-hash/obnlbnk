import { Pool } from 'pg';
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { db } from "./db";
import { cards, users, transactions, exchangeRates } from "@shared/schema";
import type { User, Card, InsertUser, Transaction, ExchangeRate } from "@shared/schema";
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
  createNFTCollection(userId: number, name: string, description: string): Promise<any>;
  createNFT(data: Omit<any, "id">): Promise<any>;
  getNFTsByUserId(userId: number): Promise<any[]>;
  getNFTCollectionsByUserId(userId: number): Promise<any[]>;
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
      console.log("Searching for card with number:", cardNumber);
      const [card] = await db
        .select()
        .from(cards)
        .where(eq(cards.number, cardNumber));
      console.log("Found card:", card);
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

        const cleanCardNumber = toCardNumber.replace(/\s+/g, '');
        const toCard = await this.getCardByNumber(cleanCardNumber);
        if (!toCard) {
          throw new Error("Карта получателя не найдена");
        }

        // Get latest exchange rates
        const rates = await this.getLatestExchangeRates();
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        // Calculate converted amount based on card types
        let convertedAmount = amount;
        let sourceAmount = amount;

        if (fromCard.type !== toCard.type) {
          // USD ↔ UAH конвертация
          if (fromCard.type === 'usd' && toCard.type === 'uah') {
            convertedAmount = amount * parseFloat(rates.usdToUah);
          } else if (fromCard.type === 'uah' && toCard.type === 'usd') {
            convertedAmount = amount / parseFloat(rates.usdToUah);
          }
          // Крипто ↔ USD конвертация
          else if (fromCard.type === 'crypto' && toCard.type === 'usd') {
            if (fromCard.btcBalance && parseFloat(fromCard.btcBalance) > 0) {
              convertedAmount = amount * parseFloat(rates.btcToUsd);
              sourceAmount = amount;
            } else if (fromCard.ethBalance && parseFloat(fromCard.ethBalance) > 0) {
              convertedAmount = amount * parseFloat(rates.ethToUsd);
              sourceAmount = amount;
            }
          }
          // USD ↔ Крипто конвертация
          else if (fromCard.type === 'usd' && toCard.type === 'crypto') {
            if (toCard.btcBalance !== null) {
              convertedAmount = amount / parseFloat(rates.btcToUsd);
            } else if (toCard.ethBalance !== null) {
              convertedAmount = amount / parseFloat(rates.ethToUsd);
            }
          }
        }

        // Calculate commission (1% от исходной суммы)
        const commission = sourceAmount * 0.01;
        // Конвертируем комиссию в BTC для регулятора
        const btcCommission = (commission * parseFloat(rates.btcToUsd)) / parseFloat(rates.btcToUsd);

        // Get regulator
        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (!regulator) {
          throw new Error("Регулятор не найден в системе");
        }

        const fromBalance = parseFloat(fromCard.balance);
        const toBalance = parseFloat(toCard.balance);

        if (isNaN(fromBalance) || isNaN(toBalance)) {
          throw new Error("Ошибка формата баланса");
        }

        // Check if sender has enough funds including commission
        if (fromCard.type === 'crypto') {
          const cryptoBalance = fromCard.btcBalance ? parseFloat(fromCard.btcBalance) : parseFloat(fromCard.ethBalance || '0');
          if (cryptoBalance < (sourceAmount + commission)) {
            throw new Error(
              `Недостаточно средств. ` +
              `Доступно: ${cryptoBalance.toFixed(8)} ${fromCard.btcBalance ? 'BTC' : 'ETH'}, ` +
              `требуется: ${sourceAmount.toFixed(8)} + ${commission.toFixed(8)} комиссия = ${(sourceAmount + commission).toFixed(8)} ${fromCard.btcBalance ? 'BTC' : 'ETH'}`
            );
          }
        } else {
          if (fromBalance < (sourceAmount + commission)) {
            throw new Error(
              `Недостаточно средств. ` +
              `Доступно: ${fromBalance.toFixed(2)} ${fromCard.type.toUpperCase()}, ` +
              `требуется: ${sourceAmount.toFixed(2)} + ${commission.toFixed(2)} комиссия = ${(sourceAmount + commission).toFixed(2)} ${fromCard.type.toUpperCase()}`
            );
          }
        }

        // Update balances
        if (fromCard.type === 'crypto') {
          if (fromCard.btcBalance) {
            await this.updateCardBtcBalance(fromCard.id, (parseFloat(fromCard.btcBalance) - sourceAmount - commission).toFixed(8));
          } else if (fromCard.ethBalance) {
            await this.updateCardEthBalance(fromCard.id, (parseFloat(fromCard.ethBalance) - sourceAmount - commission).toFixed(8));
          }
          await this.updateCardBalance(toCard.id, (toBalance + convertedAmount).toFixed(2));
        } else {
          await this.updateCardBalance(fromCard.id, (fromBalance - sourceAmount - commission).toFixed(2));
          await this.updateCardBalance(toCard.id, (toBalance + convertedAmount).toFixed(2));
        }

        // Update regulator's BTC balance
        const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
        const newRegulatorBalance = (regulatorBtcBalance + btcCommission).toFixed(8);
        await this.updateRegulatorBalance(regulator.id, newRegulatorBalance);

        // Create main transaction
        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: toCard.id,
          amount: sourceAmount.toString(),
          convertedAmount: convertedAmount.toString(),
          type: 'transfer',
          status: 'completed',
          description: fromCard.type === toCard.type ?
            `Перевод ${sourceAmount.toFixed(2)} ${fromCard.type.toUpperCase()}` :
            `Перевод ${sourceAmount.toFixed(8)} ${fromCard.type === 'crypto' ? (fromCard.btcBalance ? 'BTC' : 'ETH') : fromCard.type.toUpperCase()} → ${convertedAmount.toFixed(2)} ${toCard.type.toUpperCase()}`,
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
          wallet: null,
          description: `Комиссия 1% (${btcCommission.toFixed(8)} BTC)`,
          fromCardNumber: fromCard.number,
          toCardNumber: "REGULATOR",
          createdAt: new Date()
        });

        return { success: true, transaction };
      } catch (error) {
        console.error("Transfer error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Ошибка при переводе средств"
        };
      }
    });
  }

  async transferCrypto(fromCardId: number, recipientAddress: string, amount: number, cryptoType: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withTransaction(async () => {
      try {
        const fromCard = await this.getCardById(fromCardId);
        if (!fromCard) {
          throw new Error("Карта отправителя не найдена");
        }

        // Get latest exchange rates
        const rates = await this.getLatestExchangeRates();
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        let cryptoAmount: number;
        let usdAmount: number;

        // Determine amounts based on sender's card type
        if (fromCard.type === 'crypto') {
          // Sending from crypto card
          cryptoAmount = amount;
          usdAmount = amount * parseFloat(cryptoType === 'btc' ? rates.btcToUsd : rates.ethToUsd);
        } else {
          // Sending from fiat card
          usdAmount = amount;
          cryptoAmount = amount / parseFloat(cryptoType === 'btc' ? rates.btcToUsd : rates.ethToUsd);
        }

        // Calculate commission (1%)
        const cryptoCommission = cryptoAmount * 0.01;
        const totalCryptoNeeded = cryptoAmount + (fromCard.type === 'crypto' ? cryptoCommission : 0);

        // Check sender's balance
        if (fromCard.type === 'crypto') {
          const cryptoBalance = cryptoType === 'btc' ? parseFloat(fromCard.btcBalance || '0') : parseFloat(fromCard.ethBalance || '0');
          if (cryptoBalance < totalCryptoNeeded) {
            throw new Error(
              `Недостаточно ${cryptoType.toUpperCase()} для перевода. ` +
              `Сумма: ${cryptoAmount.toFixed(8)} ${cryptoType.toUpperCase()}, ` +
              `комиссия: ${cryptoCommission.toFixed(8)} ${cryptoType.toUpperCase()}, ` +
              `доступно: ${cryptoBalance.toFixed(8)} ${cryptoType.toUpperCase()}`
            );
          }
        } else {
          const usdCommission = usdAmount * 0.01;
          if (parseFloat(fromCard.balance) < (usdAmount + usdCommission)) {
            throw new Error(
              `Недостаточно средств. ` +
              `Доступно: ${fromCard.balance} ${fromCard.type.toUpperCase()}, ` +
              `требуется: ${usdAmount.toFixed(2)} + ${usdCommission.toFixed(2)} комиссия = ${(usdAmount + usdCommission).toFixed(2)} ${fromCard.type.toUpperCase()}`
            );
          }
        }

        // Convert commission to BTC for regulator
        let btcCommission = cryptoType === 'btc' ? cryptoCommission : (cryptoCommission * parseFloat(rates.ethToUsd)) / parseFloat(rates.btcToUsd);

        // Get regulator
        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (!regulator) {
          throw new Error("Регулятор не найден в системе");
        }

        // Update sender's balance
        if (fromCard.type === 'crypto') {
          const newBalance = cryptoType === 'btc' ?
            (parseFloat(fromCard.btcBalance || '0') - totalCryptoNeeded).toFixed(8) :
            (parseFloat(fromCard.ethBalance || '0') - totalCryptoNeeded).toFixed(8);

          if (cryptoType === 'btc') {
            await this.updateCardBtcBalance(fromCard.id, newBalance);
          } else {
            await this.updateCardEthBalance(fromCard.id, newBalance);
          }
        } else {
          const usdCommission = usdAmount * 0.01;
          await this.updateCardBalance(fromCard.id, (parseFloat(fromCard.balance) - usdAmount - usdCommission).toFixed(2));
        }

        // Update regulator's balance
        const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
        const newRegulatorBalance = (regulatorBtcBalance + btcCommission).toFixed(8);
        await this.updateRegulatorBalance(regulator.id, newRegulatorBalance);

        // Create main transaction
        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: null,
          amount: usdAmount.toString(),
          convertedAmount: cryptoAmount.toString(),
          type: 'transfer',
          status: 'completed',
          wallet: recipientAddress,
          description: fromCard.type === 'crypto' ?
            `Перевод ${cryptoAmount.toFixed(8)} ${cryptoType.toUpperCase()} на адрес ${recipientAddress}` :
            `Перевод ${usdAmount.toFixed(2)} ${fromCard.type.toUpperCase()} (${cryptoAmount.toFixed(8)} ${cryptoType.toUpperCase()}) на адрес ${recipientAddress}`,
          fromCardNumber: fromCard.number,
          toCardNumber: null,
          createdAt: new Date()
        });

        // Create commission transaction
        await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: regulator.id,
          amount: (fromCard.type === 'crypto' ? usdAmount * 0.01 : usdAmount * 0.01).toString(),
          convertedAmount: btcCommission.toString(),
          type: 'commission',
          status: 'completed',
          wallet: null,
          description: `Комиссия 1% (${btcCommission.toFixed(8)} BTC)`,
          fromCardNumber: fromCard.number,
          toCardNumber: "REGULATOR",
          createdAt: new Date()
        });

        return { success: true, transaction };

      } catch (error) {
        console.error("Error in transferCrypto:", error);
        return { success: false, error: error instanceof Error ? error.message : "Ошибка при переводе" };
      }
    });
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