/**
 * Модуль для мониторинга и анализа транзакций в реальном времени
 * Отслеживает и анализирует проблемы с транзакциями
 */

import { EventEmitter } from 'events';
import { checkTransactionStatus } from './blockchain';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { logSystemError } from './health-monitor';
import { AppError, logError } from './error-handler';

// Статусы транзакций
export type TransactionStatus = 'pending' | 'completed' | 'failed';

// Интерфейс для объекта транзакции
export interface TransactionInfo {
  id: number;
  fromCardId: number;
  toCardId?: number;
  amount: string;
  convertedAmount: string;
  type: string;
  wallet?: string;
  status: TransactionStatus;
  createdAt: Date;
  description: string;
  fromCardNumber: string;
  toCardNumber?: string;
}

// Интерфейс для результата проверки транзакции
export interface TransactionCheckResult {
  transactionId: number;
  previousStatus: TransactionStatus;
  currentStatus: TransactionStatus;
  statusChanged: boolean;
  confirmations?: number;
  error?: string;
  lastChecked: Date;
}

// Класс для мониторинга транзакций
class TransactionMonitor extends EventEmitter {
  private static instance: TransactionMonitor;
  private pendingTransactions: Map<number, { lastChecked: Date, retryCount: number }> = new Map();
  private isRunning = false;
  private checkInterval = 3 * 60 * 1000; // 3 минуты по умолчанию
  private maxRetries = 5;
  
  private constructor() {
    super();
    
    // Настраиваем частоту проверок в зависимости от окружения
    if (process.env.NODE_ENV === 'production') {
      this.checkInterval = 10 * 60 * 1000; // 10 минут в production
    } else if (process.env.NODE_ENV === 'development') {
      this.checkInterval = 2 * 60 * 1000; // 2 минуты в development
    }
  }
  
  // Singleton паттерн
  public static getInstance(): TransactionMonitor {
    if (!TransactionMonitor.instance) {
      TransactionMonitor.instance = new TransactionMonitor();
    }
    return TransactionMonitor.instance;
  }
  
  /**
   * Запускает мониторинг транзакций
   */
  public start(): void {
    if (this.isRunning) return;
    
    console.log(`🔄 Запуск мониторинга транзакций (проверка каждые ${this.checkInterval / 60000} минут)`);
    
    // Запускаем периодическую проверку статусов транзакций
    setInterval(() => this.checkPendingTransactions(), this.checkInterval);
    
    // Сразу запускаем первую проверку
    this.checkPendingTransactions();
    
    this.isRunning = true;
  }
  
  /**
   * Проверяет статус всех ожидающих транзакций
   */
  private async checkPendingTransactions(): Promise<void> {
    try {
      console.log('🔍 Проверка статуса ожидающих транзакций...');
      
      // Получаем все ожидающие транзакции из базы данных
      const pendingTransactions = await db.select().from(schema.transactions)
        .where(sql => sql.eq(schema.transactions.status, 'pending'));
      
      if (pendingTransactions.length === 0) {
        console.log('✅ Нет ожидающих транзакций для проверки');
        return;
      }
      
      console.log(`🔍 Найдено ${pendingTransactions.length} ожидающих транзакций`);
      
      // Проверяем каждую транзакцию
      for (const transaction of pendingTransactions) {
        await this.checkTransaction(transaction);
      }
      
    } catch (error) {
      console.error('❌ Ошибка при проверке ожидающих транзакций:', error);
      logSystemError('TransactionCheckError', (error as Error).message);
    }
  }
  
  /**
   * Проверяет статус конкретной транзакции
   */
  private async checkTransaction(transaction: TransactionInfo): Promise<TransactionCheckResult> {
    const transactionId = transaction.id;
    const previousStatus = transaction.status as TransactionStatus;
    let currentStatus = previousStatus;
    let confirmations = 0;
    let error = undefined;
    
    try {
      console.log(`🔍 Проверка транзакции #${transactionId} (${transaction.type}, ${transaction.wallet || 'без кошелька'})`);
      
      // Проверяем, нужно ли обновлять статус этой транзакции
      const pendingInfo = this.pendingTransactions.get(transactionId);
      const now = new Date();
      
      // Если транзакция уже проверялась недавно, пропускаем
      if (pendingInfo && pendingInfo.lastChecked) {
        const timeSinceLastCheck = now.getTime() - pendingInfo.lastChecked.getTime();
        
        // Пропускаем проверку, если прошло меньше интервала и не превышено количество попыток
        if (timeSinceLastCheck < this.checkInterval && pendingInfo.retryCount < this.maxRetries) {
          console.log(`⏳ Транзакция #${transactionId} проверялась недавно (${Math.round(timeSinceLastCheck / 1000)} сек назад), пропускаем`);
          return {
            transactionId,
            previousStatus,
            currentStatus,
            statusChanged: false,
            lastChecked: pendingInfo.lastChecked
          };
        }
      }
      
      // Определяем тип криптовалюты
      let cryptoType: 'btc' | 'eth' | null = null;
      
      if (transaction.type === 'btc' || transaction.type === 'btc_transfer') {
        cryptoType = 'btc';
      } else if (transaction.type === 'eth' || transaction.type === 'eth_transfer') {
        cryptoType = 'eth';
      }
      
      // Получаем кошелек (wallet)
      const wallet = transaction.wallet;
      
      // Если это не криптотранзакция или нет кошелька, автозавершаем
      if (!cryptoType || !wallet) {
        console.log(`ℹ️ Транзакция #${transactionId} не относится к криптовалюте или не имеет кошелька`);
        
        // Если транзакция очень старая, автоматически завершаем её
        const transactionAge = now.getTime() - new Date(transaction.createdAt).getTime();
        const isVeryOld = transactionAge > 24 * 60 * 60 * 1000; // 24 часа
        
        if (isVeryOld) {
          console.log(`🕒 Транзакция #${transactionId} старше 24 часов, автозавершение`);
          currentStatus = 'completed';
        }
      } else {
        // Для симулированных транзакций
        if (wallet.startsWith('eth_tx_')) {
          // ETH транзакции всегда автоматически завершаются
          console.log(`✅ Транзакция #${transactionId} (ETH) автоматически завершена`);
          currentStatus = 'completed';
          confirmations = 12; // Эмулируем 12 подтверждений
        } else if (wallet.startsWith('btc_tx_')) {
          // BTC транзакции могут автоматически завершаться через некоторое время
          const transactionAge = now.getTime() - new Date(transaction.createdAt).getTime();
          const shouldComplete = transactionAge > 3 * 60 * 60 * 1000; // 3 часа
          
          if (shouldComplete) {
            console.log(`✅ Транзакция #${transactionId} (BTC) автоматически завершена после 3 часов ожидания`);
            currentStatus = 'completed';
            confirmations = 6; // Эмулируем 6 подтверждений
          }
        } 
        // Для реальных транзакций (не начинающихся с btc_tx_ или eth_tx_)
        else if (wallet.startsWith('btc_err_') || wallet.startsWith('eth_err_')) {
          // Ошибочные транзакции всегда помечаются как failed
          console.log(`❌ Ошибочная транзакция #${transactionId} помечена как failed`);
          currentStatus = 'failed';
        } else {
          // Проверяем статус реальной транзакции через API
          try {
            console.log(`🔄 Проверка статуса транзакции ${wallet} через BlockDaemon API...`);
            
            const statusResult = await checkTransactionStatus(wallet, cryptoType);
            
            currentStatus = statusResult.status;
            confirmations = statusResult.confirmations || 0;
            
            console.log(`✅ Статус транзакции #${transactionId} (${cryptoType.toUpperCase()}): ${currentStatus}, ${confirmations} подтверждений`);
          } catch (apiError) {
            console.error(`❌ Ошибка при проверке транзакции через API:`, apiError);
            error = (apiError as Error).message;
            
            // Не меняем статус при ошибке API, просто логируем
          }
        }
      }
      
      // Обновляем информацию о последней проверке
      const retryCount = (pendingInfo?.retryCount || 0) + 1;
      this.pendingTransactions.set(transactionId, { lastChecked: now, retryCount });
      
      // Если статус изменился, обновляем в базе
      if (currentStatus !== previousStatus) {
        console.log(`📊 Обновление статуса транзакции #${transactionId}: ${previousStatus} -> ${currentStatus}`);
        
        await db.update(schema.transactions)
          .set({ status: currentStatus })
          .where(sql => sql.eq(schema.transactions.id, transactionId));
        
        // Если транзакция завершена или провалена, удаляем из списка ожидающих
        if (currentStatus === 'completed' || currentStatus === 'failed') {
          this.pendingTransactions.delete(transactionId);
        }
        
        // Отправляем событие об изменении статуса
        this.emit('transaction-status-changed', {
          transactionId,
          previousStatus,
          currentStatus,
          confirmations,
          type: transaction.type,
          wallet: transaction.wallet,
          amount: transaction.amount
        });
      }
      
      return {
        transactionId,
        previousStatus,
        currentStatus,
        statusChanged: currentStatus !== previousStatus,
        confirmations,
        error,
        lastChecked: now
      };
      
    } catch (error) {
      console.error(`❌ Ошибка при проверке транзакции #${transactionId}:`, error);
      logError(error instanceof AppError ? error : new Error(`Ошибка проверки транзакции #${transactionId}: ${(error as Error).message}`));
      
      return {
        transactionId,
        previousStatus,
        currentStatus,
        statusChanged: false,
        error: (error as Error).message,
        lastChecked: new Date()
      };
    }
  }
  
  /**
   * Добавляет транзакцию для отслеживания
   */
  public async trackTransaction(transactionId: number): Promise<void> {
    try {
      // Получаем информацию о транзакции
      const transaction = await db.select().from(schema.transactions)
        .where(sql => sql.eq(schema.transactions.id, transactionId))
        .limit(1);
      
      if (!transaction || transaction.length === 0) {
        console.error(`❌ Транзакция #${transactionId} не найдена для отслеживания`);
        return;
      }
      
      const tx = transaction[0];
      
      // Добавляем в список ожидающих только если статус pending
      if (tx.status === 'pending') {
        this.pendingTransactions.set(transactionId, { 
          lastChecked: new Date(0), // Давно в прошлом, чтобы проверить сразу
          retryCount: 0 
        });
        
        console.log(`➕ Транзакция #${transactionId} добавлена для отслеживания`);
        
        // Сразу проверяем статус
        await this.checkTransaction(tx);
      } else {
        console.log(`ℹ️ Транзакция #${transactionId} не требует отслеживания (статус: ${tx.status})`);
      }
      
    } catch (error) {
      console.error(`❌ Ошибка при добавлении транзакции #${transactionId} для отслеживания:`, error);
    }
  }
  
  /**
   * Получает информацию о ожидающих транзакциях
   */
  public getPendingTransactions(): { id: number, lastChecked: Date, retryCount: number }[] {
    return Array.from(this.pendingTransactions.entries()).map(([id, info]) => ({
      id,
      lastChecked: info.lastChecked,
      retryCount: info.retryCount
    }));
  }
  
  /**
   * Проверяет конкретную транзакцию вручную
   */
  public async checkTransactionById(transactionId: number): Promise<TransactionCheckResult | null> {
    try {
      // Получаем информацию о транзакции
      const transaction = await db.select().from(schema.transactions)
        .where(sql => sql.eq(schema.transactions.id, transactionId))
        .limit(1);
      
      if (!transaction || transaction.length === 0) {
        console.error(`❌ Транзакция #${transactionId} не найдена для проверки`);
        return null;
      }
      
      // Проверяем транзакцию
      return await this.checkTransaction(transaction[0]);
      
    } catch (error) {
      console.error(`❌ Ошибка при проверке транзакции #${transactionId}:`, error);
      return null;
    }
  }
  
  /**
   * Сбрасывает счетчик повторных попыток для транзакции
   */
  public resetTransactionRetryCount(transactionId: number): void {
    const info = this.pendingTransactions.get(transactionId);
    
    if (info) {
      this.pendingTransactions.set(transactionId, { 
        ...info, 
        retryCount: 0 
      });
      console.log(`🔄 Сброшен счетчик повторных попыток для транзакции #${transactionId}`);
    }
  }
}

// Экспортируем синглтон
export const transactionMonitor = TransactionMonitor.getInstance();

/**
 * Запускает мониторинг транзакций
 */
export function startTransactionMonitoring(): void {
  transactionMonitor.start();
}

/**
 * Добавляет транзакцию для отслеживания
 */
export function trackTransaction(transactionId: number): Promise<void> {
  return transactionMonitor.trackTransaction(transactionId);
}

/**
 * Проверяет конкретную транзакцию вручную
 */
export function checkTransaction(transactionId: number): Promise<TransactionCheckResult | null> {
  return transactionMonitor.checkTransactionById(transactionId);
}

/**
 * Получает информацию о ожидающих транзакциях
 */
export function getPendingTransactions(): { id: number, lastChecked: Date, retryCount: number }[] {
  return transactionMonitor.getPendingTransactions();
}

/**
 * Сбрасывает счетчик повторных попыток для транзакции
 */
export function resetTransactionRetryCount(transactionId: number): void {
  transactionMonitor.resetTransactionRetryCount(transactionId);
}

// Экспортируем основные функции
export default {
  startTransactionMonitoring,
  trackTransaction,
  checkTransaction,
  getPendingTransactions,
  resetTransactionRetryCount,
  transactionMonitor
};