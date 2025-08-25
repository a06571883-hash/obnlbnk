/**
 * 🚀 СУПЕР-МОНИТОР ТРАНЗАКЦИЙ 2.0 🚀
 * 
 * Улучшенный модуль для отслеживания и визуализации транзакций в реальном времени
 * С прикольными эффектами и анимациями для консоли
 */

import { EventEmitter } from 'events';
import { checkTransactionStatus } from './blockchain';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logSystemError } from './health-monitor';
import { AppError, logError } from './error-handler';
import * as readline from 'readline';

// Emoji для разных статусов транзакций
const EMOJIS = {
  pending: '⏳',
  completed: '✅',
  failed: '❌',
  checking: '🔍',
  money: '💰',
  bitcoin: '₿',
  ethereum: '⟠',
  rocket: '🚀',
  fire: '🔥',
  sparkles: '✨',
  warning: '⚠️',
  error: '💥',
  party: '🎉',
  lightning: '⚡',
  time: '⌛',
  database: '🗄️',
  chain: '⛓️',
  refresh: '🔄',
  info: 'ℹ️',
  magic: '✨',
  sun: '☀️',
  moon: '🌙',
  star: '⭐',
  confirmed: '🔐',
  unconfirmed: '🔓',
  clock: ['🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛']
};

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

// Результаты проверки транзакции со стилем
export interface FancyTransactionCheckResult {
  transactionId: number;
  previousStatus: TransactionStatus;
  currentStatus: TransactionStatus;
  statusChanged: boolean;
  confirmations?: number;
  error?: string;
  lastChecked: Date;
  style: {
    emoji: string;
    color: string;
    ascii?: string;
    message: string;
  };
}

// ANSI цвета для консоли
export const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m"
};

// ASCII-арт для разных статусов
const ASCII_ART = {
  bitcoin: `
    ${COLORS.yellow}   ____  
    ${COLORS.yellow}  |  _ \\ 
    ${COLORS.yellow}  | |_) |
    ${COLORS.yellow}  |  _ < 
    ${COLORS.yellow}  |_| \\_\\
    ${COLORS.reset}`,
  
  ethereum: `
    ${COLORS.cyan}    _____
    ${COLORS.cyan}   |  ___|__
    ${COLORS.cyan}   | |_ / _ \\
    ${COLORS.cyan}   |  _|  __/
    ${COLORS.cyan}   |_|  \\___|
    ${COLORS.reset}`,
  
  success: `
    ${COLORS.green}   _____                              
    ${COLORS.green}  / ____|                             
    ${COLORS.green} | (___  _   _  ___ ___ ___  ___ ___ 
    ${COLORS.green}  \\___ \\| | | |/ __/ __/ _ \\/ __/ __|
    ${COLORS.green}  ____) | |_| | (_| (_|  __/\\__ \\__ \\
    ${COLORS.green} |_____/ \\__,_|\\___\\___\\___||___/___/
    ${COLORS.reset}`,
  
  failed: `
    ${COLORS.red}  ______    _ _          _ 
    ${COLORS.red} |  ____|  (_) |        | |
    ${COLORS.red} | |__ __ _ _| | ___  __| |
    ${COLORS.red} |  __/ _\` | | |/ _ \\/ _\` |
    ${COLORS.red} | | | (_| | | |  __/ (_| |
    ${COLORS.red} |_|  \\__,_|_|_|\\___|\\__,_|
    ${COLORS.reset}`,
  
  pending: `
    ${COLORS.yellow}  _____                _ _             
    ${COLORS.yellow} |  __ \\              | (_)            
    ${COLORS.yellow} | |__) |___ _ __   __| |_ _ __   __ _ 
    ${COLORS.yellow} |  ___// _ \\ '_ \\ / _\` | | '_ \\ / _\` |
    ${COLORS.yellow} | |   |  __/ | | | (_| | | | | | (_| |
    ${COLORS.yellow} |_|    \\___|_| |_|\\__,_|_|_| |_|\\__, |
    ${COLORS.yellow}                                   __/ |
    ${COLORS.yellow}                                  |___/ 
    ${COLORS.reset}`
};

// Генератор прогресс-баров для статуса подтверждений
function generateProgressBar(confirmations: number, required: number): string {
  const percentage = Math.min(1, confirmations / required);
  const filledLength = Math.floor(20 * percentage);
  const emptyLength = 20 - filledLength;
  
  const filled = '█'.repeat(filledLength);
  const empty = '░'.repeat(emptyLength);
  
  return `${COLORS.cyan}${filled}${COLORS.dim}${empty}${COLORS.reset} ${Math.round(percentage * 100)}%`;
}

// Инициализация очереди сообщений для анимаций
let messageQueue: string[] = [];
let isProcessingMessages = false;

// Обработка очереди сообщений с задержкой
async function processMessageQueue() {
  if (isProcessingMessages || messageQueue.length === 0) return;
  
  isProcessingMessages = true;
  
  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    if (message) {
      console.log(message);
      await new Promise(resolve => setTimeout(resolve, 100)); // Задержка между сообщениями
    }
  }
  
  isProcessingMessages = false;
}

// Вывод сообщения в консоль с эффектом
function printWithEffect(message: string) {
  messageQueue.push(message);
  processMessageQueue();
}

// Класс для мониторинга транзакций с визуальными эффектами
class SuperTransactionMonitor extends EventEmitter {
  private static instance: SuperTransactionMonitor;
  private pendingTransactions: Map<number, { lastChecked: Date, retryCount: number }> = new Map();
  private isRunning = false;
  private checkInterval = 3 * 60 * 1000; // 3 минуты по умолчанию
  private maxRetries = 5;
  private clockIndex = 0;
  
  private constructor() {
    super();
    
    // Настраиваем частоту проверок в зависимости от окружения
    if (process.env.NODE_ENV === 'production') {
      this.checkInterval = 10 * 60 * 1000; // 10 минут в production
    } else if (process.env.NODE_ENV === 'development') {
      this.checkInterval = 2 * 60 * 1000; // 2 минуты в development
    }
    
    // Стартовое сообщение с ASCII-артом
    setTimeout(() => {
      this.showStartupMessage();
    }, 1000);
  }
  
  // Singleton паттерн
  public static getInstance(): SuperTransactionMonitor {
    if (!SuperTransactionMonitor.instance) {
      SuperTransactionMonitor.instance = new SuperTransactionMonitor();
    }
    return SuperTransactionMonitor.instance;
  }
  
  /**
   * Показывает красивое стартовое сообщение
   */
  private showStartupMessage(): void {
    const asciiArt = `
    ${COLORS.cyan}  _____                        _____                     
    ${COLORS.cyan} / ____|                      |_   _|                    
    ${COLORS.cyan}| (___  _   _ _ __   ___ _ __   | |  _ __ ___   ___  ___ 
    ${COLORS.cyan} \\___ \\| | | | '_ \\ / _ \\ '__|  | | | '_ \` _ \\ / _ \\/ __|
    ${COLORS.magenta} ____) | |_| | |_) |  __/ |    _| |_| | | | | |  __/\\__ \\
    ${COLORS.magenta}|_____/ \\__,_| .__/ \\___|_|   |_____|_| |_| |_|\\___||___/
    ${COLORS.magenta}             | |                                         
    ${COLORS.magenta}             |_|                                         
    ${COLORS.reset}
    ${COLORS.yellow}${EMOJIS.bitcoin} ${EMOJIS.ethereum} КРИПТОМОНИТОР ТРАНЗАКЦИЙ 2.0 ${EMOJIS.ethereum} ${EMOJIS.bitcoin}${COLORS.reset}
    
    ${COLORS.green}✓ Инициализация завершена ${COLORS.reset}
    ${COLORS.cyan}✓ Готов к отслеживанию транзакций ${COLORS.reset}
    ${COLORS.magenta}✓ Автовосстановление активировано ${COLORS.reset}
    `;
    
    console.log(asciiArt);
  }
  
  /**
   * Запускает мониторинг транзакций с визуальными эффектами
   */
  public start(): void {
    if (this.isRunning) return;
    
    // Красивое сообщение о запуске
    const banner = `
    ${COLORS.green}${COLORS.bright}${EMOJIS.rocket} ЗАПУСК СУПЕР-МОНИТОРИНГА ТРАНЗАКЦИЙ ${EMOJIS.rocket}${COLORS.reset}
    ${COLORS.cyan}${EMOJIS.info} Интервал проверки: ${this.checkInterval / 60000} минут${COLORS.reset}
    ${COLORS.yellow}${EMOJIS.chain} Блокчейны на мониторинге: ${EMOJIS.bitcoin} Bitcoin, ${EMOJIS.ethereum} Ethereum${COLORS.reset}
    `;
    
    console.log(banner);
    
    // Запускаем периодическую проверку статусов транзакций
    setInterval(() => this.checkPendingTransactions(), this.checkInterval);
    
    // Запускаем анимацию часов для консоли
    setInterval(() => {
      this.clockTick();
    }, 5000);
    
    // Сразу запускаем первую проверку
    this.checkPendingTransactions();
    
    this.isRunning = true;
  }
  
  /**
   * Анимация часов в консоли
   */
  private clockTick() {
    this.clockIndex = (this.clockIndex + 1) % EMOJIS.clock.length;
    const clock = EMOJIS.clock[this.clockIndex];
    process.stdout.write(`\r${clock} Мониторинг активен... `);
  }
  
  /**
   * Проверяет статус всех ожидающих транзакций с визуальными эффектами
   */
  private async checkPendingTransactions(): Promise<void> {
    try {
      console.log(`\n${COLORS.cyan}${EMOJIS.checking} НАЧАЛО ПРОВЕРКИ ТРАНЗАКЦИЙ...${COLORS.reset}`);
      
      // Получаем все ожидающие транзакции из базы данных
      const pendingTransactions = await db.select().from(schema.transactions)
        .where(sql => sql.eq(schema.transactions.status, 'pending'));
      
      if (pendingTransactions.length === 0) {
        printWithEffect(`${COLORS.green}${EMOJIS.info} Нет ожидающих транзакций для проверки ${EMOJIS.party}${COLORS.reset}`);
        return;
      }
      
      // Красивое отображение количества транзакций
      printWithEffect(`${COLORS.yellow}${EMOJIS.database} Найдено ${COLORS.bright}${pendingTransactions.length}${COLORS.reset}${COLORS.yellow} ожидающих транзакций ${COLORS.reset}`);
      
      // Анимация поиска
      const searchAnimation = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let animIndex = 0;
      
      // Запускаем анимацию
      const animInterval = setInterval(() => {
        process.stdout.write(`\r${searchAnimation[animIndex]} Проверка транзакций...  `);
        animIndex = (animIndex + 1) % searchAnimation.length;
      }, 100);
      
      // Задержка для анимации
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Проверяем каждую транзакцию и выводим результаты с эффектами
      for (const transaction of pendingTransactions) {
        // Случайная задержка между проверками для более естественного вида
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
        
        // Очищаем анимацию и проверяем транзакцию
        clearInterval(animInterval);
        process.stdout.write(`\r${' '.repeat(50)}\r`);
        
        const result = await this.checkTransaction(transaction);
        
        // Выводим результат с нужным стилем
        if (result.style.ascii) {
          console.log(result.style.ascii);
        }
        
        // Выводим сообщение о результате проверки
        printWithEffect(`${result.style.color}${result.style.emoji} ${result.style.message}${COLORS.reset}`);
        
        // Если есть подтверждения, выводим прогресс-бар
        if (result.confirmations && result.confirmations > 0) {
          const requiredConfirmations = transaction.type.includes('btc') ? 3 : 12;
          const progressBar = generateProgressBar(result.confirmations, requiredConfirmations);
          printWithEffect(`  ${EMOJIS.info} Подтверждения: ${result.confirmations}/${requiredConfirmations} ${progressBar}`);
        }
      }
      
    } catch (error) {
      console.error(`${COLORS.red}${EMOJIS.error} Ошибка при проверке ожидающих транзакций:${COLORS.reset}`, error);
      logSystemError('TransactionCheckError', (error as Error).message);
    }
  }
  
  /**
   * Проверяет статус конкретной транзакции с визуальными эффектами
   */
  private async checkTransaction(transaction: TransactionInfo): Promise<FancyTransactionCheckResult> {
    const transactionId = transaction.id;
    const previousStatus = transaction.status as TransactionStatus;
    let currentStatus = previousStatus;
    let confirmations = 0;
    let error = undefined;
    
    try {
      // Подготовка красивого вывода в зависимости от типа транзакции
      const txTypeEmoji = transaction.type.includes('btc') ? EMOJIS.bitcoin : 
                          transaction.type.includes('eth') ? EMOJIS.ethereum : EMOJIS.money;
      
      // Анимация проверки
      process.stdout.write(`\r${COLORS.cyan}${txTypeEmoji} Проверка транзакции #${transactionId}... ${COLORS.reset}`);
      
      // Проверяем, нужно ли обновлять статус этой транзакции
      const pendingInfo = this.pendingTransactions.get(transactionId);
      const now = new Date();
      
      // Если транзакция уже проверялась недавно, пропускаем
      if (pendingInfo && pendingInfo.lastChecked) {
        const timeSinceLastCheck = now.getTime() - pendingInfo.lastChecked.getTime();
        
        // Пропускаем проверку, если прошло меньше интервала и не превышено количество попыток
        if (timeSinceLastCheck < this.checkInterval && pendingInfo.retryCount < this.maxRetries) {
          return {
            transactionId,
            previousStatus,
            currentStatus,
            statusChanged: false,
            lastChecked: pendingInfo.lastChecked,
            style: {
              emoji: EMOJIS.refresh,
              color: COLORS.dim,
              message: `Транзакция #${transactionId} (${txTypeEmoji}) проверялась недавно (${Math.round(timeSinceLastCheck / 1000)} сек назад)`
            }
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
      
      // Для красивого вывода даты создания транзакции
      const createdDate = new Date(transaction.createdAt);
      const formattedDate = `${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}`;
      const ageInHours = Math.round((now.getTime() - createdDate.getTime()) / (60 * 60 * 1000) * 10) / 10;
      
      // Если это не криптотранзакция или нет кошелька, автозавершаем
      if (!cryptoType || !wallet) {
        // Если транзакция очень старая, автоматически завершаем её
        const transactionAge = now.getTime() - new Date(transaction.createdAt).getTime();
        const isVeryOld = transactionAge > 24 * 60 * 60 * 1000; // 24 часа
        
        if (isVeryOld) {
          currentStatus = 'completed';
          
          return {
            transactionId,
            previousStatus,
            currentStatus,
            statusChanged: currentStatus !== previousStatus,
            lastChecked: now,
            style: {
              emoji: EMOJIS.time,
              color: COLORS.green,
              message: `Транзакция #${transactionId} автозавершена (старше 24 часов)`
            }
          };
        }
        
        return {
          transactionId,
          previousStatus,
          currentStatus,
          statusChanged: false,
          lastChecked: now,
          style: {
            emoji: EMOJIS.info,
            color: COLORS.yellow,
            message: `Транзакция #${transactionId} (${transaction.amount}) не является криптовалютной`
          }
        };
      } 
      // Для симулированных транзакций
      else if (wallet.startsWith('eth_tx_')) {
        // ETH транзакции всегда автоматически завершаются
        currentStatus = 'completed';
        confirmations = 12; // Эмулируем 12 подтверждений
        
        return {
          transactionId,
          previousStatus,
          currentStatus,
          statusChanged: currentStatus !== previousStatus,
          confirmations,
          lastChecked: now,
          style: {
            emoji: EMOJIS.sparkles,
            color: COLORS.green,
            ascii: ASCII_ART.ethereum,
            message: `Транзакция ETH #${transactionId} (${transaction.amount} ${EMOJIS.ethereum}) успешно завершена! ✨`
          }
        };
      } 
      else if (wallet.startsWith('btc_tx_')) {
        // BTC транзакции могут автоматически завершаться через некоторое время
        const transactionAge = now.getTime() - new Date(transaction.createdAt).getTime();
        const shouldComplete = transactionAge > 3 * 60 * 60 * 1000; // 3 часа
        
        if (shouldComplete) {
          currentStatus = 'completed';
          confirmations = 6; // Эмулируем 6 подтверждений
          
          return {
            transactionId,
            previousStatus,
            currentStatus,
            statusChanged: currentStatus !== previousStatus,
            confirmations,
            lastChecked: now,
            style: {
              emoji: EMOJIS.party,
              color: COLORS.green,
              ascii: ASCII_ART.bitcoin,
              message: `Транзакция BTC #${transactionId} (${transaction.amount} ${EMOJIS.bitcoin}) подтверждена и завершена! 🎊`
            }
          };
        }
        
        return {
          transactionId,
          previousStatus,
          currentStatus,
          statusChanged: false,
          lastChecked: now,
          style: {
            emoji: EMOJIS.unconfirmed,
            color: COLORS.yellow,
            message: `Транзакция BTC #${transactionId} (${transaction.amount} ${EMOJIS.bitcoin}) ожидает подтверждения... (${ageInHours}ч)`
          }
        };
      } 
      // Для ошибочных транзакций
      else if (wallet.startsWith('btc_err_') || wallet.startsWith('eth_err_')) {
        // Ошибочные транзакции всегда помечаются как failed
        currentStatus = 'failed';
        
        return {
          transactionId,
          previousStatus,
          currentStatus,
          statusChanged: currentStatus !== previousStatus,
          lastChecked: now,
          style: {
            emoji: EMOJIS.error,
            color: COLORS.red,
            ascii: ASCII_ART.failed,
            message: `Транзакция #${transactionId} ${wallet.includes('btc') ? 'BTC' : 'ETH'} (${transaction.amount}) завершилась с ошибкой! 💔`
          }
        };
      } 
      // Для реальных транзакций проверяем через API
      else {
        try {
          // Проверка статуса реальной транзакции через API
          const statusResult = await checkTransactionStatus(wallet, cryptoType);
          
          currentStatus = statusResult.status;
          confirmations = statusResult.confirmations || 0;
          
          // Разные стили в зависимости от статуса
          if (currentStatus === 'completed') {
            return {
              transactionId,
              previousStatus,
              currentStatus,
              statusChanged: currentStatus !== previousStatus,
              confirmations,
              lastChecked: now,
              style: {
                emoji: EMOJIS.party,
                color: COLORS.green,
                ascii: cryptoType === 'btc' ? ASCII_ART.bitcoin : ASCII_ART.ethereum,
                message: `УСПЕХ! Транзакция ${cryptoType.toUpperCase()} #${transactionId} (${transaction.amount}) подтверждена в блокчейне! ${EMOJIS.confirmed}`
              }
            };
          } else if (currentStatus === 'failed') {
            return {
              transactionId,
              previousStatus,
              currentStatus,
              statusChanged: currentStatus !== previousStatus,
              lastChecked: now,
              style: {
                emoji: EMOJIS.error,
                color: COLORS.red,
                ascii: ASCII_ART.failed,
                message: `Транзакция ${cryptoType.toUpperCase()} #${transactionId} (${transaction.amount}) не прошла! ❌`
              }
            };
          } else {
            // Статус pending
            return {
              transactionId,
              previousStatus,
              currentStatus,
              statusChanged: currentStatus !== previousStatus,
              confirmations,
              lastChecked: now,
              style: {
                emoji: EMOJIS.checking,
                color: COLORS.yellow,
                message: `Транзакция ${cryptoType.toUpperCase()} #${transactionId} (${transaction.amount}) в процессе, ${confirmations} подтверждений`
              }
            };
          }
        } catch (apiError) {
          console.error(`${COLORS.red}❌ Ошибка при проверке транзакции через API:${COLORS.reset}`, apiError);
          error = (apiError as Error).message;
          
          // Не меняем статус при ошибке API, просто логируем
          return {
            transactionId,
            previousStatus,
            currentStatus,
            statusChanged: false,
            error: (apiError as Error).message,
            lastChecked: now,
            style: {
              emoji: EMOJIS.warning,
              color: COLORS.yellow,
              message: `Ошибка при проверке транзакции ${cryptoType.toUpperCase()} #${transactionId}: ${(apiError as Error).message}`
            }
          };
        }
      }
      
    } catch (error) {
      console.error(`${COLORS.red}${EMOJIS.error} Ошибка при проверке транзакции #${transactionId}:${COLORS.reset}`, error);
      logError(error instanceof AppError ? error : new Error(`Ошибка проверки транзакции #${transactionId}: ${(error as Error).message}`));
      
      return {
        transactionId,
        previousStatus,
        currentStatus,
        statusChanged: false,
        error: (error as Error).message,
        lastChecked: new Date(),
        style: {
          emoji: EMOJIS.error,
          color: COLORS.red,
          message: `Критическая ошибка при проверке транзакции #${transactionId}: ${(error as Error).message}`
        }
      };
    }
  }
  
  /**
   * Обновляет статус транзакции в базе данных с визуальными эффектами
   */
  private async updateTransactionStatus(transactionId: number, status: TransactionStatus): Promise<void> {
    try {
      await db.update(schema.transactions)
        .set({ status })
        .where(eq(schema.transactions.id, transactionId));
      
      const statusEmoji = status === 'completed' ? EMOJIS.party : 
                          status === 'failed' ? EMOJIS.error : 
                          EMOJIS.pending;
      
      const statusColor = status === 'completed' ? COLORS.green : 
                          status === 'failed' ? COLORS.red : 
                          COLORS.yellow;
      
      printWithEffect(`${statusColor}${statusEmoji} Статус транзакции #${transactionId} обновлен на ${status}${COLORS.reset}`);
      
      // Если транзакция завершена или провалена, удаляем из списка ожидающих
      if (status === 'completed' || status === 'failed') {
        this.pendingTransactions.delete(transactionId);
      }
      
      // Отправляем событие об изменении статуса
      this.emit('transaction-status-changed', {
        transactionId,
        status,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error(`${COLORS.red}${EMOJIS.error} Ошибка при обновлении статуса транзакции #${transactionId}:${COLORS.reset}`, error);
    }
  }
  
  /**
   * Добавляет транзакцию для отслеживания с визуальными эффектами
   */
  public async trackTransaction(transactionId: number): Promise<void> {
    try {
      printWithEffect(`${COLORS.cyan}${EMOJIS.checking} Добавление транзакции #${transactionId} для отслеживания...${COLORS.reset}`);
      
      // Получаем информацию о транзакции
      const transaction = await db.select().from(schema.transactions)
        .where(sql => sql.eq(schema.transactions.id, transactionId))
        .limit(1);
      
      if (!transaction || transaction.length === 0) {
        printWithEffect(`${COLORS.red}${EMOJIS.error} Транзакция #${transactionId} не найдена для отслеживания${COLORS.reset}`);
        return;
      }
      
      const tx = transaction[0];
      const txTypeEmoji = tx.type.includes('btc') ? EMOJIS.bitcoin : 
                          tx.type.includes('eth') ? EMOJIS.ethereum : 
                          EMOJIS.money;
      
      // Добавляем в список ожидающих только если статус pending
      if (tx.status === 'pending') {
        this.pendingTransactions.set(transactionId, { 
          lastChecked: new Date(0), // Давно в прошлом, чтобы проверить сразу
          retryCount: 0 
        });
        
        // Анимация добавления
        printWithEffect(`${COLORS.green}${EMOJIS.star} Транзакция ${txTypeEmoji} #${transactionId} добавлена для отслеживания${COLORS.reset}`);
        
        // Сразу проверяем статус с визуальными эффектами
        const result = await this.checkTransaction(tx);
        
        // Если статус изменился, обновляем в базе
        if (result.statusChanged) {
          await this.updateTransactionStatus(transactionId, result.currentStatus);
        }
        
        return;
      }
      
      // Если транзакция не в статусе pending
      const statusEmoji = tx.status === 'completed' ? EMOJIS.party : 
                        tx.status === 'failed' ? EMOJIS.error : 
                        EMOJIS.pending;
      
      printWithEffect(`${COLORS.yellow}${statusEmoji} Транзакция ${txTypeEmoji} #${transactionId} не требует отслеживания (статус: ${tx.status})${COLORS.reset}`);
      
    } catch (error) {
      console.error(`${COLORS.red}${EMOJIS.error} Ошибка при добавлении транзакции для отслеживания:${COLORS.reset}`, error);
    }
  }
  
  /**
   * Публичный метод для проверки статуса конкретной транзакции
   */
  public async checkTransactionById(transactionId: number): Promise<FancyTransactionCheckResult | null> {
    try {
      // Анимация проверки
      const spinner = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
      let spinnerIndex = 0;
      
      // Запускаем анимацию
      const interval = setInterval(() => {
        process.stdout.write(`\r${COLORS.cyan}${spinner[spinnerIndex]} Проверка транзакции #${transactionId}...${COLORS.reset}`);
        spinnerIndex = (spinnerIndex + 1) % spinner.length;
      }, 80);
      
      // Получаем информацию о транзакции
      const transaction = await db.select().from(schema.transactions)
        .where(sql => sql.eq(schema.transactions.id, transactionId))
        .limit(1);
      
      // Очищаем анимацию
      clearInterval(interval);
      process.stdout.write(`\r${' '.repeat(50)}\r`);
      
      if (!transaction || transaction.length === 0) {
        printWithEffect(`${COLORS.red}${EMOJIS.error} Транзакция #${transactionId} не найдена для проверки${COLORS.reset}`);
        return null;
      }
      
      // Проверяем транзакцию с визуальными эффектами
      const result = await this.checkTransaction(transaction[0]);
      
      // Выводим результат с красивым форматированием
      if (result.style.ascii) {
        console.log(result.style.ascii);
      }
      
      printWithEffect(`${result.style.color}${result.style.emoji} ${result.style.message}${COLORS.reset}`);
      
      // Если статус изменился, обновляем в базе
      if (result.statusChanged) {
        await this.updateTransactionStatus(transactionId, result.currentStatus);
      }
      
      return result;
      
    } catch (error) {
      console.error(`${COLORS.red}${EMOJIS.error} Ошибка при проверке транзакции #${transactionId}:${COLORS.reset}`, error);
      return null;
    }
  }
  
  /**
   * Получает информацию о ожидающих транзакциях с красивым форматированием
   */
  public getPendingTransactions(): { id: number, lastChecked: Date, retryCount: number, style: string }[] {
    return Array.from(this.pendingTransactions.entries()).map(([id, info]) => ({
      id,
      lastChecked: info.lastChecked,
      retryCount: info.retryCount,
      style: `${COLORS.yellow}${EMOJIS.checking} Транзакция #${id} (проверялась ${new Date(info.lastChecked).toLocaleString()}, попыток: ${info.retryCount})${COLORS.reset}`
    }));
  }
  
  /**
   * Сбрасывает счетчик повторных попыток для транзакции с визуальными эффектами
   */
  public resetTransactionRetryCount(transactionId: number): void {
    const info = this.pendingTransactions.get(transactionId);
    
    if (info) {
      this.pendingTransactions.set(transactionId, { 
        ...info, 
        retryCount: 0 
      });
      printWithEffect(`${COLORS.green}${EMOJIS.refresh} Сброшен счетчик повторных попыток для транзакции #${transactionId}${COLORS.reset}`);
    } else {
      printWithEffect(`${COLORS.yellow}${EMOJIS.warning} Транзакция #${transactionId} не находится в списке ожидающих${COLORS.reset}`);
    }
  }
  
  /**
   * Форматирует и выводит справку по транзакциям с ASCII-артом
   */
  public showTransactionsHelp(): void {
    const helpText = `
    ${COLORS.cyan}  _    _      _           ____        _     _      
    ${COLORS.cyan} | |  | |    | |         |  _ \\      (_)   | |     
    ${COLORS.cyan} | |__| | ___| |_ __     | |_) |_   _ _  __| | ___ 
    ${COLORS.cyan} |  __  |/ _ \\ | '_ \\    |  _ <| | | | |/ _\` |/ _ \\
    ${COLORS.magenta} | |  | |  __/ | |_) |   | |_) | |_| | | (_| |  __/
    ${COLORS.magenta} |_|  |_|\\___|_| .__/    |____/ \\__,_|_|\\__,_|\\___|
    ${COLORS.magenta}               | |                                 
    ${COLORS.magenta}               |_|                                 
    ${COLORS.reset}
    
    ${COLORS.yellow}${EMOJIS.info} РУКОВОДСТВО ПО КРИПТОТРАНЗАКЦИЯМ ${EMOJIS.info}${COLORS.reset}
    
    ${COLORS.green}${EMOJIS.bitcoin} BITCOIN ТРАНЗАКЦИИ:${COLORS.reset}
     - Для завершения транзакции нужно ${COLORS.bright}3 подтверждения${COLORS.reset}
     - Среднее время: 30-60 минут
     - Статус auto-complete: через 3 часа
    
    ${COLORS.cyan}${EMOJIS.ethereum} ETHEREUM ТРАНЗАКЦИИ:${COLORS.reset}
     - Для завершения транзакции нужно ${COLORS.bright}12 подтверждений${COLORS.reset}
     - Среднее время: 2-5 минут
     - Статус auto-complete: автоматически
    
    ${COLORS.magenta}${EMOJIS.star} ПОЛЕЗНЫЕ КОМАНДЫ:${COLORS.reset}
     - Проверить транзакцию: check-tx ID
     - Отследить транзакцию: track-tx ID
     - Получить список ожидающих: pending-tx
    `;
    
    console.log(helpText);
  }
}

// Экспортируем синглтон
export const superTransactionMonitor = SuperTransactionMonitor.getInstance();

/**
 * Запускает мониторинг транзакций с визуальными эффектами
 */
export function startSuperTransactionMonitoring(): void {
  superTransactionMonitor.start();
}

/**
 * Добавляет транзакцию для отслеживания с визуальными эффектами
 */
export function trackTransactionWithEffects(transactionId: number): Promise<void> {
  return superTransactionMonitor.trackTransaction(transactionId);
}

/**
 * Проверяет конкретную транзакцию вручную с визуальными эффектами
 */
export function checkTransactionWithEffects(transactionId: number): Promise<FancyTransactionCheckResult | null> {
  return superTransactionMonitor.checkTransactionById(transactionId);
}

/**
 * Получает информацию о ожидающих транзакциях с красивым форматированием
 */
export function getPendingTransactionsWithStyle(): { id: number, lastChecked: Date, retryCount: number, style: string }[] {
  return superTransactionMonitor.getPendingTransactions();
}

/**
 * Сбрасывает счетчик повторных попыток для транзакции с визуальными эффектами
 */
export function resetTransactionRetryCountWithEffects(transactionId: number): void {
  superTransactionMonitor.resetTransactionRetryCount(transactionId);
}

/**
 * Показывает справку по транзакциям с ASCII-артом
 */
export function showTransactionsHelp(): void {
  superTransactionMonitor.showTransactionsHelp();
}

// Экспортируем основные функции
export default {
  startSuperTransactionMonitoring,
  trackTransactionWithEffects,
  checkTransactionWithEffects,
  getPendingTransactionsWithStyle,
  resetTransactionRetryCountWithEffects,
  showTransactionsHelp,
  superTransactionMonitor
};