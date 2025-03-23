import * as schema from "@shared/schema";
import { InsertCard, InsertTransaction, InsertUser, Transaction, User, Card, cards, exchangeRates, transactions, users } from "@shared/schema";
import { eq, sql, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import express from "express";
import session from "express-session";
import { Store } from "express-session";
import postgres from "postgres";
import PGSession from "connect-pg-simple";
import { client, db } from "./db";
import { validateCryptoAddress } from "./utils/crypto";
import { hasBlockchainApiKeys, sendBitcoinTransaction, sendEthereumTransaction, checkTransactionStatus } from "./utils/blockchain";
import { BlockchainError } from "./utils/error-handler";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCardsByUserId(userId: number): Promise<Card[]>;
  createCard(card: Omit<Card, "id">): Promise<Card>;
  sessionStore: Store;
  getAllUsers(): Promise<User[]>;
  updateRegulatorBalance(userId: number, balance: string): Promise<void>;
  updateCardBalance(cardId: number, balance: string): Promise<void>;
  updateCardBtcBalance(cardId: number, balance: string): Promise<void>;
  updateCardEthBalance(cardId: number, balance: string): Promise<void>;
  getCardById(cardId: number): Promise<Card | undefined>;
  getCardByNumber(cardNumber: string): Promise<Card | undefined>;
  getTransactionsByCardId(cardId: number): Promise<Transaction[]>;
  createTransaction(transaction: Omit<Transaction, "id">, txDb?: any): Promise<Transaction>;
  transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
  transferCrypto(fromCardId: number, recipientAddress: string, amount: number, cryptoType: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
  getLatestExchangeRates(): Promise<any | undefined>;
  updateExchangeRates(rates: { usdToUah: number; btcToUsd: number; ethToUsd: number }): Promise<any>;
  createNFTCollection(userId: number, name: string, description: string): Promise<any>;
  createNFT(data: Omit<any, "id">): Promise<any>;
  getNFTsByUserId(userId: number): Promise<any[]>;
  getNFTCollectionsByUserId(userId: number): Promise<any[]>;
  canGenerateNFT(userId: number): Promise<boolean>;
  updateUserNFTGeneration(userId: number): Promise<void>;
  getTransactionsByCardIds(cardIds: number[]): Promise<Transaction[]>;
  createDefaultCardsForUser(userId: number): Promise<void>;
  deleteUser(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: Store;

  constructor() {
    const PGSessionStore = PGSession(session);
    this.sessionStore = new PGSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production',
      },
      tableName: 'session'
    } as any);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.withRetry(async () => {
      try {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
      } catch (error) {
        console.error(`Error fetching user by ID ${id}:`, error);
        throw error;
      }
    }, 'Get User by ID');
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      try {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user;
      } catch (error) {
        console.error(`Error fetching user by username ${username}:`, error);
        throw error;
      }
    }, 'Get User by Username');
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      try {
        const [user] = await db.insert(users).values(insertUser).returning();
        return user;
      } catch (error) {
        console.error("Error creating user:", error);
        throw error;
      }
    }, 'Create User');
  }

  async getCardsByUserId(userId: number): Promise<Card[]> {
    return this.withRetry(async () => {
      try {
        const userCards = await db.select().from(cards).where(eq(cards.userId, userId)).orderBy(asc(cards.id));
        return userCards;
      } catch (error) {
        console.error(`Error fetching cards for user ${userId}:`, error);
        throw error;
      }
    }, 'Get Cards by User ID');
  }

  async createCard(card: Omit<Card, "id">): Promise<Card> {
    return this.withRetry(async () => {
      try {
        const [result] = await db.insert(cards).values(card).returning();
        return result;
      } catch (error) {
        console.error("Error creating card:", error);
        throw error;
      }
    }, 'Create Card');
  }

  async getAllUsers(): Promise<User[]> {
    return this.withRetry(async () => {
      try {
        return await db.select().from(users);
      } catch (error) {
        console.error("Error fetching all users:", error);
        throw error;
      }
    }, 'Get All Users');
  }

  async updateRegulatorBalance(userId: number, balance: string): Promise<void> {
    return this.withRetry(async () => {
      try {
        await db.update(users)
          .set({ regulator_balance: balance, updatedAt: new Date() })
          .where(eq(users.id, userId));
      } catch (error) {
        console.error(`Error updating regulator balance for user ${userId}:`, error);
        throw error;
      }
    }, 'Update Regulator Balance');
  }

  async updateCardBalance(cardId: number, balance: string): Promise<void> {
    return this.withRetry(async () => {
      try {
        await db.update(cards)
          .set({ balance: balance, updatedAt: new Date() })
          .where(eq(cards.id, cardId));
      } catch (error) {
        console.error(`Error updating balance for card ${cardId}:`, error);
        throw error;
      }
    }, 'Update Card Balance');
  }

  async updateCardBtcBalance(cardId: number, balance: string): Promise<void> {
    return this.withRetry(async () => {
      try {
        await db.update(cards)
          .set({ btcBalance: balance, updatedAt: new Date() })
          .where(eq(cards.id, cardId));
      } catch (error) {
        console.error(`Error updating BTC balance for card ${cardId}:`, error);
        throw error;
      }
    }, 'Update Card BTC Balance');
  }

  async updateCardEthBalance(cardId: number, balance: string): Promise<void> {
    return this.withRetry(async () => {
      try {
        await db.update(cards)
          .set({ ethBalance: balance, updatedAt: new Date() })
          .where(eq(cards.id, cardId));
      } catch (error) {
        console.error(`Error updating ETH balance for card ${cardId}:`, error);
        throw error;
      }
    }, 'Update Card ETH Balance');
  }

  async getCardById(cardId: number): Promise<Card | undefined> {
    return this.withRetry(async () => {
      try {
        const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
        return card;
      } catch (error) {
        console.error(`Error fetching card by ID ${cardId}:`, error);
        throw error;
      }
    }, 'Get Card by ID');
  }

  async getCardByNumber(cardNumber: string): Promise<Card | undefined> {
    return this.withRetry(async () => {
      try {
        const [card] = await db.select().from(cards).where(eq(cards.number, cardNumber));
        return card;
      } catch (error) {
        console.error(`Error fetching card by number ${cardNumber}:`, error);
        throw error;
      }
    }, 'Get Card by Number');
  }

  async getTransactionsByCardId(cardId: number): Promise<Transaction[]> {
    return this.withRetry(async () => {
      try {
        return await db.select().from(transactions).where(
          sql`${transactions.fromCardId} = ${cardId} OR ${transactions.toCardId} = ${cardId}`
        ).orderBy(sql`${transactions.createdAt} DESC`);
      } catch (error) {
        console.error(`Error fetching transactions for card ${cardId}:`, error);
        throw error;
      }
    }, 'Get Transactions by Card ID');
  }

  async createTransaction(transaction: Omit<Transaction, "id">, txDb?: any): Promise<Transaction> {
    return this.withRetry(async () => {
      try {
        // Используем переданное соединение с транзакцией, если оно есть
        const database = txDb || db;
        
        // Логируем информацию о переданном соединении
        console.log(`📊 Создание транзакции с ${txDb ? 'переданным txDb' : 'глобальным db'}`);
        if (txDb) {
          console.log(`📋 txDb содержит: ${Object.keys(txDb).join(', ')}`);
        }
        
        // Находим максимальный ID и инкрементируем его вручную
        const [maxIdResult] = await database.select({ maxId: sql`COALESCE(MAX(id), 0)` }).from(transactions);
        const nextId = Number(maxIdResult?.maxId || 0) + 1;

        console.log(`Создание транзакции с ID ${nextId}:`, transaction);
        
        const [result] = await database.insert(transactions).values({
          ...transaction,
          id: nextId,
          wallet: transaction.wallet || null,
          description: transaction.description || "",
          createdAt: new Date()
        }).returning();
        
        console.log(`Транзакция успешно создана:`, result);
        return result;
      } catch (error) {
        console.error(`Ошибка при создании транзакции:`, error);
        // Логируем дополнительную информацию об ошибке
        if (error instanceof Error) {
          console.error(`🔴 Тип ошибки: ${error.name}, сообщение: ${error.message}`);
          console.error(`🔴 Стек: ${error.stack}`);
        }
        
        throw error;
      }
    }, 'Create transaction');
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withTransaction(async () => {
      try {
        // Блокируем карты отправителя
        const [fromCard] = await db.select().from(cards).where(eq(cards.id, fromCardId));
        if (!fromCard) {
          throw new Error("Карта отправителя не найдена");
        }

        // Блокируем карту получателя
        const [toCard] = await db.select().from(cards).where(eq(cards.number, toCardNumber));
        if (!toCard) {
          throw new Error("Карта получателя не найдена");
        }

        // Проверяем карты на принадлежность одному пользователю (только для разных типов карт)
        if (fromCard.userId === toCard.userId && fromCard.type === toCard.type) {
          throw new Error("Нельзя переводить между своими картами одного типа");
        }

        // Текущий баланс отправителя
        const fromBalance = parseFloat(fromCard.balance);
        
        // Комиссия
        const commission = amount * 0.01;
        const totalDebit = amount + commission;

        // Проверяем, достаточно ли средств
        if (fromBalance < totalDebit) {
          throw new Error(`Недостаточно средств. Доступно: ${fromBalance.toFixed(2)} ${fromCard.type.toUpperCase()}, требуется: ${amount.toFixed(2)} + ${commission.toFixed(2)} комиссия = ${totalDebit.toFixed(2)} ${fromCard.type.toUpperCase()}`);
        }

        // Получаем курсы валют
        const [rates] = await db.select().from(exchangeRates).orderBy(sql`${exchangeRates.id} DESC`).limit(1);
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        // Списываем сумму с отправителя
        await this.updateCardBalance(fromCard.id, (fromBalance - totalDebit).toFixed(2));

        // Конвертируем валюту если нужно
        let convertedAmount = amount;
        
        if (fromCard.type !== toCard.type) {
          // Преобразуем всё в USD как промежуточную валюту
          let amountInUsd;
          
          // Конвертируем из валюты отправителя в USD
          if (fromCard.type === 'uah') {
            amountInUsd = amount / parseFloat(rates.usdToUah);
          } else if (fromCard.type === 'usd') {
            amountInUsd = amount;
          } else if (fromCard.type === 'crypto') {
            amountInUsd = amount * parseFloat(rates.btcToUsd);
          }
          
          // Конвертируем из USD в валюту получателя
          if (toCard.type === 'uah') {
            convertedAmount = amountInUsd! * parseFloat(rates.usdToUah);
          } else if (toCard.type === 'usd') {
            convertedAmount = amountInUsd!;
          } else if (toCard.type === 'crypto') {
            convertedAmount = amountInUsd! / parseFloat(rates.btcToUsd);
          }
        }

        // Зачисляем сумму получателю
        const toBalance = parseFloat(toCard.balance);
        await this.updateCardBalance(toCard.id, (toBalance + convertedAmount).toFixed(2));

        // Выплачиваем комиссию регулятору
        const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
        if (regulator) {
          // Преобразуем комиссию в BTC
          let btcCommission;
          
          if (fromCard.type === 'usd') {
            btcCommission = commission / parseFloat(rates.btcToUsd);
          } else if (fromCard.type === 'uah') {
            const usdValue = commission / parseFloat(rates.usdToUah);
            btcCommission = usdValue / parseFloat(rates.btcToUsd);
          } else if (fromCard.type === 'crypto') {
            btcCommission = commission;
          } else {
            // Неизвестный тип карты - используем usd по умолчанию
            btcCommission = commission / parseFloat(rates.btcToUsd);
          }
          
          // Обновляем баланс регулятора
          const regulatorBalance = parseFloat(regulator.regulator_balance || '0');
          await this.updateRegulatorBalance(regulator.id, (regulatorBalance + btcCommission).toFixed(8));
        }

        // Создаем запись о транзакции
        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: toCard.id,
          amount: amount.toString(),
          convertedAmount: convertedAmount.toString(),
          type: 'transfer',
          status: 'completed',
          description: `Перевод ${amount.toFixed(fromCard.type === 'crypto' ? 8 : 2)} ${fromCard.type.toUpperCase()} → ${convertedAmount.toFixed(toCard.type === 'crypto' ? 8 : 2)} ${toCard.type.toUpperCase()} (курс: ${(convertedAmount / amount).toFixed(2)})`,
          fromCardNumber: fromCard.number,
          toCardNumber: toCard.number,
          wallet: null,
          createdAt: new Date()
        }, null);

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
        }, null);

        return { success: true, transaction };
      } catch (error) {
        console.error("Transfer error:", error);
        throw error;
      }
    }, "Transfer Money Operation");
  }

  async transferCrypto(fromCardId: number, recipientAddress: string, amount: number, cryptoType: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    // Убираем транзакцию для обхода проблемы с parsers
    try {
      console.log(`🔄 Начало крипто-транзакции БЕЗ ТРАНЗАКЦИИ: ${fromCardId} → ${recipientAddress} (${amount} ${cryptoType})`);
    
      const fromCard = await this.getCardById(fromCardId);
      if (!fromCard) {
        throw new Error("Карта отправителя не найдена");
      }

        const rates = await this.getLatestExchangeRates();
        if (!rates) {
          throw new Error("Не удалось получить актуальные курсы валют");
        }

        // Ищем карту получателя в зависимости от типа криптовалюты
        let toCard;
        if (cryptoType === 'btc') {
          // Для BTC находим карту по BTC-адресу или номеру карты
          const [btcCard] = await db.select().from(cards).where(eq(cards.btcAddress, recipientAddress));
          toCard = btcCard || await this.getCardByNumber(recipientAddress);
          console.log(`🔍 Поиск карты получателя по BTC-адресу ${recipientAddress}:`, toCard);
        } else if (cryptoType === 'eth') {
          // Для ETH находим карту по ETH-адресу или номеру карты
          const [ethCard] = await db.select().from(cards).where(eq(cards.ethAddress, recipientAddress));
          toCard = ethCard || await this.getCardByNumber(recipientAddress);
          console.log(`🔍 Поиск карты получателя по ETH-адресу ${recipientAddress}:`, toCard);
        } else {
          toCard = await this.getCardByNumber(recipientAddress);
          console.log(`🔍 Поиск карты получателя по номеру ${recipientAddress}:`, toCard);
        }

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
          if (cryptoType === 'btc') {
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
            // Отправляем напрямую в ETH
            const ethToSend = amount;
            const ethCommission = commission;
            btcToSend = amount * (parseFloat(rates.ethToUsd) / parseFloat(rates.btcToUsd)); // Конвертируем ETH в BTC для учета
            btcCommission = commission * (parseFloat(rates.ethToUsd) / parseFloat(rates.btcToUsd)); // Комиссия в BTC эквиваленте

            const ethBalance = parseFloat(fromCard.ethBalance || '0');
            if (ethBalance < totalDebit) {
              throw new Error(
                `Недостаточно ETH. Доступно: ${ethBalance.toFixed(8)} ETH, ` +
                `требуется: ${amount.toFixed(8)} + ${commission.toFixed(8)} комиссия = ${totalDebit.toFixed(8)} ETH`
              );
            }

            // Снимаем ETH с отправителя
            await this.updateCardEthBalance(fromCard.id, (ethBalance - totalDebit).toFixed(8));
            console.log(`Снято с отправителя: ${totalDebit.toFixed(8)} ETH`);
          }
        } else {
          // Конвертируем из фиатной валюты в BTC
          let usdAmount: number;

          // Сначала конвертируем в USD если нужно
          if (fromCard.type === 'uah') {
            usdAmount = amount / parseFloat(rates.usdToUah);
          } else {
            usdAmount = amount;
          }

          // Конвертируем USD в BTC или ETH
          if (cryptoType === 'btc') {
            btcToSend = usdAmount / parseFloat(rates.btcToUsd);
            btcCommission = (usdAmount * 0.01) / parseFloat(rates.btcToUsd);
          } else {
            btcToSend = usdAmount / parseFloat(rates.ethToUsd); // Это на самом деле ETH, но мы храним в той же переменной
            btcCommission = (usdAmount * 0.01) / parseFloat(rates.ethToUsd);
            // Конвертируем ethToSend в BTC эквивалент для учета
            btcToSend = btcToSend * (parseFloat(rates.ethToUsd) / parseFloat(rates.btcToUsd));
            btcCommission = btcCommission * (parseFloat(rates.ethToUsd) / parseFloat(rates.btcToUsd));
          }

          const fiatBalance = parseFloat(fromCard.balance);
          if (fiatBalance < totalDebit) {
            throw new Error(
              `Недостаточно средств. Доступно: ${fiatBalance.toFixed(2)} ${fromCard.type.toUpperCase()}, ` +
              `требуется: ${amount.toFixed(2)} + ${commission.toFixed(2)} комиссия = ${totalDebit.toFixed(2)} ${fromCard.type.toUpperCase()}`
            );
          }

          // Снимаем деньги с фиатной карты
          await this.updateCardBalance(fromCard.id, (fiatBalance - totalDebit).toFixed(2));
          console.log(`Снято с отправителя: ${totalDebit.toFixed(2)} ${fromCard.type.toUpperCase()}`);
        }

        let transactionMode: 'internal' | 'blockchain' | 'simulated' = 'blockchain';
        let txId: string = 'simulated_tx_' + Date.now();

        // Если это внутренний перевод (между картами в системе)
        if (toCard) {
          transactionMode = 'internal';
          console.log(`🏦 Внутренний перевод на карту ${toCard.id}`);

          // Зачисляем крипту или конвертируем и зачисляем фиат
          if (toCard.type === 'crypto') {
            if (cryptoType === 'btc') {
              const toBtcBalance = parseFloat(toCard.btcBalance || '0');
              await this.updateCardBtcBalance(toCard.id, (toBtcBalance + btcToSend).toFixed(8));
              console.log(`Зачислено на карту ${toCard.id}: ${btcToSend.toFixed(8)} BTC`);
            } else {
              // Для ETH нужно конвертировать обратно из BTC в ETH
              const ethToSend = fromCard.type === 'crypto' 
                ? amount 
                : btcToSend * (parseFloat(rates.btcToUsd) / parseFloat(rates.ethToUsd));
              
              const toEthBalance = parseFloat(toCard.ethBalance || '0');
              await this.updateCardEthBalance(toCard.id, (toEthBalance + ethToSend).toFixed(8));
              console.log(`Зачислено на карту ${toCard.id}: ${ethToSend.toFixed(8)} ETH`);
            }
          } else {
            // Конвертируем BTC в фиатную валюту получателя
            let convertedAmount: number;
            
            // Сначала конвертируем в USD
            const usdAmount = btcToSend * parseFloat(rates.btcToUsd);
            
            // Затем в нужную валюту
            if (toCard.type === 'uah') {
              convertedAmount = usdAmount * parseFloat(rates.usdToUah);
            } else {
              convertedAmount = usdAmount;
            }
            
            const toFiatBalance = parseFloat(toCard.balance);
            await this.updateCardBalance(toCard.id, (toFiatBalance + convertedAmount).toFixed(2));
            console.log(`Зачислено на карту ${toCard.id}: ${convertedAmount.toFixed(2)} ${toCard.type.toUpperCase()}`);
          }
        } else {
          // Внешний перевод на криптоадрес
          // Проверяем валидность внешнего адреса
          if (!validateCryptoAddress(recipientAddress, cryptoType)) {
            throw new Error(`Недействительный ${cryptoType.toUpperCase()} адрес`);
          }
          console.log(`Адрес ${recipientAddress} валиден. Отправляем на внешний адрес...`);
          
          // Устанавливаем режим транзакции по умолчанию в 'blockchain'
          const apiStatus = hasBlockchainApiKeys();
          
          console.log(`🔐 Проверка API ключей: available=${apiStatus.available}, blockdaemon=${apiStatus.blockdaemon}`);
          console.log(`🔐 Причина (если недоступно): ${apiStatus.reason || 'Нет ошибок'}`);
          
          // ВАЖНО! Всегда форсируем режим блокчейна независимо от API ключей для тестирования
          transactionMode = 'blockchain';
          console.log(`🔐 Режим транзакции установлен на: ${transactionMode}`);
          
          // Отправляем реальную криптотранзакцию через блокчейн
          let txResult;
          
          try {
            if (cryptoType === 'btc') {
              // Логика для Bitcoin транзакций
              txResult = await sendBitcoinTransaction(
                fromCard.btcAddress || '',  // Адрес отправителя
                recipientAddress,           // Адрес получателя
                btcToSend                   // Сумма в BTC
              );
              console.log(`✅ BTC транзакция запущена: ${txResult.txId} (статус: ${txResult.status})`);
              txId = txResult.txId;
              
              // Если получен реальный ID транзакции (не начинается с btc_tx_ или btc_err_)
              if (!txId.startsWith('btc_tx_') && !txId.startsWith('btc_err_')) {
                // Это настоящая блокчейн-транзакция
                console.log(`🚀 BTC транзакция успешно отправлена в блокчейн! TxID: ${txId}`);
                
                // Проверяем статус транзакции через 5 секунд, чтобы убедиться, что она началась
                setTimeout(async () => {
                  try {
                    console.log(`🔍 Проверка начальной обработки BTC транзакции: ${txId}`);
                    const status = await checkTransactionStatus(txId || '', 'btc');
                    if (status.status === 'failed') {
                      console.error(`❌ BTC транзакция не прошла: ${txId}`);
                      
                      // Если транзакция завершилась с ошибкой, возвращаем средства пользователю
                      const originalBtcBalance = parseFloat(fromCard.btcBalance || '0');
                      await this.updateCardBtcBalance(fromCard.id, originalBtcBalance.toFixed(8));
                      console.log(`♻️ Возвращены средства пользователю: ${totalDebit.toFixed(8)} BTC на карту ${fromCard.id}`);
                      
                      // Создаем запись о возврате средств
                      await this.createTransaction({
                        fromCardId: regulator.id,
                        toCardId: fromCard.id,
                        amount: totalDebit.toString(),
                        convertedAmount: '0',
                        type: 'refund',
                        status: 'completed',
                        description: `Возврат средств: ${amount.toFixed(8)} BTC (транзакция не прошла)`,
                        fromCardNumber: "SYSTEM",
                        toCardNumber: fromCard.number,
                        wallet: null,
                        createdAt: new Date()
                      });
                    } else {
                      console.log(`✅ BTC транзакция ${txId} в обработке (статус: ${status.status})`);
                    }
                  } catch (checkError) {
                    console.error(`❌ Ошибка при проверке BTC транзакции:`, checkError);
                  }
                }, 5000);
              }
            } else {
              // Логика для Ethereum транзакций               
              // При отправке ETH, если это крипто-карта, мы используем прямую сумму в ETH
              // Если это фиатная карта, конвертируем из BTC в ETH
              const ethAmount = fromCard.type === 'crypto' 
                ? amount  // Прямая сумма в ETH
                : btcToSend * (parseFloat(rates.btcToUsd) / parseFloat(rates.ethToUsd)); // Конвертация из BTC в ETH
              
              txResult = await sendEthereumTransaction(
                fromCard.ethAddress || '',  // Адрес отправителя
                recipientAddress,           // Адрес получателя
                ethAmount                   // Сумма в ETH
              );
              console.log(`✅ ETH транзакция запущена: ${txResult.txId} (статус: ${txResult.status})`);
              txId = txResult.txId;
              
              console.log(`🚀 ETH транзакция успешно отправлена в блокчейн! TxID: ${txId}`);
              
              // Проверяем статус транзакции через 5 секунд, чтобы убедиться, что она началась
              setTimeout(async () => {
                try {
                  console.log(`🔍 Проверка начальной обработки ETH транзакции: ${txId}`);
                  const status = await checkTransactionStatus(txId || '', 'eth');
                  if (status.status === 'failed') {
                    console.error(`❌ ETH транзакция не прошла: ${txId}`);
                    
                    // Если транзакция завершилась с ошибкой, возвращаем средства пользователю
                    const originalEthBalance = parseFloat(fromCard.ethBalance || '0');
                    await this.updateCardEthBalance(fromCard.id, originalEthBalance.toFixed(8));
                    console.log(`♻️ Возвращены средства пользователю: ${totalDebit.toFixed(8)} ETH на карту ${fromCard.id}`);
                    
                    // Создаем запись о возврате средств
                    await this.createTransaction({
                      fromCardId: regulator.id,
                      toCardId: fromCard.id,
                      amount: totalDebit.toString(),
                      convertedAmount: '0',
                      type: 'refund',
                      status: 'completed',
                      description: `Возврат средств: ${amount.toFixed(8)} ETH (транзакция не прошла)`,
                      fromCardNumber: "SYSTEM",
                      toCardNumber: fromCard.number,
                      wallet: null,
                      createdAt: new Date()
                    }, txDb);
                  } else {
                    console.log(`✅ ETH транзакция ${txId} в обработке (статус: ${status.status})`);
                  }
                } catch (checkError) {
                  console.error(`❌ Ошибка при проверке ETH транзакции:`, checkError);
                }
              }, 5000);
            }
          } catch (blockchainError) {
            console.error(`❌ Ошибка отправки ${cryptoType.toUpperCase()} транзакции:`, blockchainError);
            // Продолжаем выполнение, даже если реальная отправка не удалась
            console.log(`⚠️ Продолжаем в режиме симуляции...`);
            transactionMode = 'simulated';
          }
        }

        // Зачисляем комиссию регулятору
        const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
        await this.updateRegulatorBalance(
          regulator.id,
          (regulatorBtcBalance + btcCommission).toFixed(8)
        );

        // Создаем транзакцию с информацией о режиме
        const transactionDescription = (() => {
          let baseDescription = '';
          
          if (fromCard.type === 'crypto') {
            baseDescription = `Отправка ${amount.toFixed(8)} ${cryptoType.toUpperCase()} на адрес ${recipientAddress}`;
          } else if (cryptoType === 'btc') {
            baseDescription = `Конвертация ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} → ${btcToSend.toFixed(8)} BTC и отправка на адрес ${recipientAddress}`;
          } else {
            baseDescription = `Конвертация ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} → ${(btcToSend * (parseFloat(rates.btcToUsd) / parseFloat(rates.ethToUsd))).toFixed(8)} ETH и отправка на адрес ${recipientAddress}`;
          }
          
          // Добавляем информацию о режиме работы
          if (transactionMode === 'internal') {
            return baseDescription + " (внутренний перевод)";
          } else if (transactionMode === 'simulated') {
            return baseDescription + " (СИМУЛЯЦИЯ - средства списаны, но блокчейн-транзакция не выполнена)";
          } else {
            return baseDescription + " (блокчейн)";
          }
        })();
        
        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: toCard?.id || null,
          amount: fromCard.type === 'crypto' ? amount.toString() : amount.toString(),
          convertedAmount: (btcToSend).toString(),
          type: 'crypto_transfer',
          status: 'completed',
          description: transactionDescription,
          fromCardNumber: fromCard.number,
          toCardNumber: toCard?.number || recipientAddress,
          wallet: recipientAddress,
          createdAt: new Date()
        }, txDb);

        // Создаем транзакцию комиссии
        await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: regulator.id,
          amount: fromCard.type === 'crypto' ? commission.toString() : commission.toString(),
          convertedAmount: btcCommission.toString(),
          type: 'commission',
          status: 'completed',
          description: `Комиссия за перевод ${cryptoType.toUpperCase()} ${cryptoType === 'btc' ? 
                        `(${btcCommission.toFixed(8)} BTC)` : 
                        `(${commission.toFixed(8)} ETH ~ ${btcCommission.toFixed(8)} BTC)`}`,
          fromCardNumber: fromCard.number,
          toCardNumber: "REGULATOR",
          wallet: null,
          createdAt: new Date()
        }, txDb);

        return { success: true, transaction };
      } catch (error) {
        console.error("Crypto transfer error:", error);
        throw error;
      }
    }, "Crypto Transfer Operation");
  }

  private async withTransaction<T>(operation: (db: any) => Promise<T>, context: string, maxAttempts = 3): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Повторная попытка транзакции ${attempt + 1}/${maxAttempts}: ${context}`);
        } else {
          console.log(`🔄 Начало транзакции: ${context}`);
        }
        
        // Проверяем, доступно ли postgres-соединение
        if (!client || typeof client.begin !== 'function') {
          throw new Error(`Нет доступного соединения с PostgreSQL или метод begin недоступен`);
        }
        
        // Используем client.begin() метод для транзакций в postgres.js
        return await client.begin(async (sqlWithTx) => {
          console.log(`✅ Транзакция начата: ${context}`);
          
          if (!sqlWithTx) {
            throw new Error(`Транзакционное соединение не инициализировано в ${context}`);
          }
          
          try {
            // Создаем экземпляр Drizzle с транзакционным соединением и явным указанием схемы
            const txDb = drizzle(sqlWithTx, { 
              schema: {
                cards,
                exchangeRates,
                transactions,
                users
              }
            });
            
            // Проверяем что txDb корректно создан
            if (!txDb) {
              throw new Error(`Не удалось создать транзакционный экземпляр Drizzle в ${context}`);
            }
            
            // Проверяем доступность таблиц в схеме
            const schemaKeys = Object.keys(txDb);
            console.log(`📊 Доступные таблицы в транзакции: ${schemaKeys.join(', ')}`);
            
            // Выполняем операцию с транзакционным экземпляром Drizzle
            const result = await operation(txDb);
            
            console.log(`✅ Транзакция успешно завершена: ${context}`);
            return result;
          } catch (innerError: any) {
            console.error(`❌ Внутренняя ошибка транзакции ${context}:`, innerError);
            throw innerError; // Пробрасываем ошибку для обработки во внешнем блоке
          }
        });
      } catch (error: any) {
        // Определяем тип ошибки для решения о повторной попытке
        const isRetryable = 
          error.code === '40001' || // Serialization failure
          error.code === '40P01' || // Deadlock detected
          error.message?.includes('serializable') ||
          error.message?.includes('deadlock') ||
          error.message?.includes('conflict') ||
          error.message?.includes('duplicate');
        
        // Если ошибка может быть решена повторной попыткой и у нас есть еще попытки
        if (isRetryable && attempt < maxAttempts - 1) {
          console.warn(`⚠️ Транзакция отменена из-за конфликта (${context}), попытка ${attempt + 1}/${maxAttempts}:`);
          console.warn(`   - Код: ${error.code || 'Неизвестно'}`);
          console.warn(`   - Сообщение: ${error.message || 'Нет сообщения'}`);
          
          // Экспоненциальная задержка с элементом случайности
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
          console.warn(`   - Повторная попытка через ${Math.round(delay/1000)} секунд...`);
          
          // Ждем перед повторной попыткой
          lastError = error;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Если это последняя попытка или ошибка не поддается повторной попытке
        console.error(`❌ Транзакция не удалась (${context}), попытка ${attempt + 1}/${maxAttempts}:`);
        console.error(`   - Код: ${error.code || 'Неизвестно'}`);
        console.error(`   - Сообщение: ${error.message || 'Нет сообщения'}`);
        console.error(`   - SQL: ${error.sql || 'Нет SQL'}`);
        console.error(`   - Stack: ${error.stack || 'Нет стека'}`);
        
        // Сохраняем ошибку и бросаем исключение, если это последняя попытка
        lastError = error;
        if (attempt === maxAttempts - 1) {
          console.error(`Transfer error: ${error.stack}`);
          throw new Error(`Не удалось выполнить операцию '${context}' после ${maxAttempts} попыток: ${error.message}`);
        }
      }
    }
    
    // Если все попытки исчерпаны, возвращаем последнюю ошибку
    throw lastError || new Error(`Транзакция ${context} не удалась после ${maxAttempts} попыток`);
  }

  private async withRetry<T>(operation: () => Promise<T>, context: string, maxAttempts = 5): Promise<T> {
    let lastError: Error | undefined;
    const MAX_DELAY = 30000; // Максимальная задержка между попытками (30 секунд)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Логируем только первую и последующие попытки, но не каждую
        if (attempt > 0) {
          console.log(`🔄 ${context}: повторная попытка ${attempt + 1}/${maxAttempts}`);
        }
        
        return await operation();
      } catch (error: any) {
        lastError = error as Error;
        
        // Категоризируем ошибки
        const isTransientError = 
          error.code === 'ECONNRESET' || 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNREFUSED' ||
          error.message.includes('connection') ||
          error.message.includes('timeout') ||
          error.code === '40P01'; // Deadlock detected
          
        // Если ошибка временная и у нас есть еще попытки
        if (isTransientError && attempt < maxAttempts - 1) {
          const delay = Math.min(Math.pow(2, attempt) * 1000 + Math.random() * 1000, MAX_DELAY);
          console.warn(`⚠️ ${context}: ошибка, повторная попытка через ${Math.round(delay/1000)}s`, error.message || error);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Для неустранимых ошибок или последней попытки
        console.error(`❌ ${context}: ошибка после ${attempt + 1} попыток`, error);
        throw error;
      }
    }
    
    throw lastError || new Error(`${context} не удалось после ${maxAttempts} попыток`);
  }

  async getLatestExchangeRates(): Promise<any | undefined> {
    return this.withRetry(async () => {
      try {
        const [rate] = await db.select().from(exchangeRates).orderBy(sql`${exchangeRates.id} DESC`).limit(1);
        return rate;
      } catch (error) {
        console.error("Error fetching latest exchange rates:", error);
        throw error;
      }
    }, 'Get Latest Exchange Rates');
  }

  async updateExchangeRates(rates: { usdToUah: number; btcToUsd: number; ethToUsd: number }): Promise<any> {
    return this.withRetry(async () => {
      try {
        const [result] = await db.insert(exchangeRates).values({
          usdToUah: rates.usdToUah.toString(),
          btcToUsd: rates.btcToUsd.toString(),
          ethToUsd: rates.ethToUsd.toString(),
          updatedAt: new Date()
        }).returning();
        return result;
      } catch (error) {
        console.error("Error updating exchange rates:", error);
        throw error;
      }
    }, 'Update Exchange Rates');
  }

  async createNFTCollection(userId: number, name: string, description: string): Promise<any> {
    // Имитация создания коллекции NFT
    return { id: Date.now(), userId, name, description, createdAt: new Date() };
  }

  async createNFT(data: Omit<any, "id">): Promise<any> {
    // Имитация создания NFT
    return { id: Date.now(), ...data, createdAt: new Date() };
  }

  async getNFTsByUserId(userId: number): Promise<any[]> {
    // Имитация получения списка NFT пользователя
    return []; 
  }

  async getNFTCollectionsByUserId(userId: number): Promise<any[]> {
    // Имитация получения списка коллекций NFT
    return [];
  }

  async canGenerateNFT(userId: number): Promise<boolean> {
    // Имитация проверки возможности создания NFT
    return true;
  }

  async updateUserNFTGeneration(userId: number): Promise<void> {
    // Имитация обновления данных о создании NFT
  }

  async getTransactionsByCardIds(cardIds: number[]): Promise<Transaction[]> {
    try {
      const cardIdsStr = cardIds.join(',');
      const result = await db.select().from(transactions)
        .where(sql`${transactions.fromCardId} IN (${sql.raw(cardIdsStr)}) OR ${transactions.toCardId} IN (${sql.raw(cardIdsStr)})`)
        .orderBy(sql`${transactions.createdAt} DESC`);
      return result;
    } catch (error) {
      console.error(`Error fetching transactions for card IDs [${cardIds.join(', ')}]:`, error);
      throw error;
    }
  }

  async createDefaultCardsForUser(userId: number): Promise<void> {
    // Логика создания дефолтных карт для нового пользователя
    // ...
  }

  async deleteUser(userId: number): Promise<void> {
    // Логика удаления пользователя и связанных данных
    // ...
  }
}

export const storage = new DatabaseStorage();

function generateCardNumber(type: 'crypto' | 'usd' | 'uah'): string {
  let prefix;
  switch (type) {
    case 'crypto':
      prefix = '4111';
      break;
    case 'usd':
      prefix = '4112';
      break;
    case 'uah':
      prefix = '4113';
      break;
    default:
      prefix = '4000';
  }
  
  return prefix + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
}