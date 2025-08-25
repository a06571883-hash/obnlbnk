/**
 * Модуль с API для диагностики и исправления проблем системы
 */

import express, { Request, Response } from 'express';
import { runDiagnostics, checkBlockDaemonApiAccess, fixStuckTransactions } from './utils/problem-solver';
import { getSystemHealth, clearSystemErrorLog } from './utils/health-monitor';
import { 
  startTransactionMonitoring, 
  trackTransaction, 
  checkTransaction, 
  getPendingTransactions 
} from './utils/transaction-monitor';
import {
  startSuperTransactionMonitoring,
  trackTransactionWithEffects,
  checkTransactionWithEffects,
  getPendingTransactionsWithStyle,
  showTransactionsHelp,
  COLORS
} from './utils/super-transaction-monitor';

// Локальное определение EMOJIS
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
import { hasBlockchainApiKeys } from './utils/blockchain';
import { AppError, NotFoundError } from './utils/error-handler';

const router = express.Router();

/**
 * Middleware для проверки доступа администратора
 */
function requireAdmin(req: Request, res: Response, next: express.NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      status: 'error',
      message: 'Требуется авторизация'
    });
  }

  if (!req.user || !(req.user as any).is_regulator) {
    return res.status(403).json({
      status: 'error',
      message: 'Нет доступа. Требуются права администратора'
    });
  }

  next();
}

/**
 * Получает статус API ключей для блокчейна
 * GET /api/diagnostics/api-keys
 */
router.get('/api-keys', requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = hasBlockchainApiKeys();
    
    res.json({
      status: 'success',
      data: status
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message
    });
  }
});

/**
 * Запускает полную диагностику системы
 * GET /api/diagnostics/run
 */
router.get('/run', requireAdmin, async (req: Request, res: Response) => {
  try {
    const results = await runDiagnostics();
    
    res.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message
    });
  }
});

/**
 * Получает информацию о здоровье системы
 * GET /api/diagnostics/health
 */
router.get('/health', requireAdmin, async (req: Request, res: Response) => {
  try {
    const health = getSystemHealth();
    
    res.json({
      status: 'success',
      data: health
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message
    });
  }
});

/**
 * Очищает лог ошибок
 * POST /api/diagnostics/clear-errors
 */
router.post('/clear-errors', requireAdmin, async (req: Request, res: Response) => {
  try {
    clearSystemErrorLog();
    
    res.json({
      status: 'success',
      message: 'Лог ошибок очищен'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message
    });
  }
});

/**
 * Запускает мониторинг транзакций
 * POST /api/diagnostics/transactions/start-monitoring
 */
router.post('/transactions/start-monitoring', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Определяем, какой вид мониторинга запустить
    const useSuper = req.query.super === 'true' || req.body.super === true;
    
    if (useSuper) {
      startSuperTransactionMonitoring();
      
      res.json({
        status: 'success',
        message: '🚀 СУПЕР-мониторинг транзакций запущен! 🎉',
        type: 'super'
      });
    } else {
      startTransactionMonitoring();
      
      res.json({
        status: 'success',
        message: 'Стандартный мониторинг транзакций запущен',
        type: 'standard'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message
    });
  }
});

/**
 * Получает список ожидающих транзакций
 * GET /api/diagnostics/transactions/pending
 */
router.get('/transactions/pending', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Определяем, какой вид списка использовать
    const useSuper = req.query.super === 'true';
    
    let pendingTransactions;
    
    if (useSuper) {
      // Используем стильный список с форматированием
      pendingTransactions = getPendingTransactionsWithStyle();
      
      res.json({
        status: 'success',
        data: pendingTransactions,
        listType: 'super',
        message: '🚀 Получен СТИЛЬНЫЙ список ожидающих транзакций! ✨'
      });
    } else {
      // Используем стандартный список
      pendingTransactions = getPendingTransactions();
      
      res.json({
        status: 'success',
        data: pendingTransactions,
        listType: 'standard'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message
    });
  }
});

/**
 * Проверяет статус транзакции
 * GET /api/diagnostics/transactions/:id/check
 */
router.get('/transactions/:id/check', requireAdmin, async (req: Request, res: Response) => {
  try {
    const transactionId = parseInt(req.params.id, 10);
    
    if (isNaN(transactionId)) {
      throw new AppError('Некорректный ID транзакции', 400);
    }
    
    // Определяем, какой вид проверки использовать
    const useSuper = req.query.super === 'true';
    
    let result;
    
    if (useSuper) {
      // Используем супер-проверку с визуальными эффектами
      result = await checkTransactionWithEffects(transactionId);
    } else {
      // Используем стандартную проверку
      result = await checkTransaction(transactionId);
    }
    
    if (!result) {
      throw new NotFoundError(`Транзакция #${transactionId} не найдена`);
    }
    
    // Добавляем информацию о типе проверки в ответ
    res.json({
      status: 'success',
      data: result,
      checkType: useSuper ? 'super' : 'standard'
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
        code: error.errorCode
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: (error as Error).message
      });
    }
  }
});

/**
 * Добавляет транзакцию для отслеживания
 * POST /api/diagnostics/transactions/:id/track
 */
router.post('/transactions/:id/track', requireAdmin, async (req: Request, res: Response) => {
  try {
    const transactionId = parseInt(req.params.id, 10);
    
    if (isNaN(transactionId)) {
      throw new AppError('Некорректный ID транзакции', 400);
    }
    
    // Определяем, какой вид отслеживания использовать
    const useSuper = req.query.super === 'true' || req.body.super === true;
    
    if (useSuper) {
      // Используем супер-отслеживание с визуальными эффектами
      await trackTransactionWithEffects(transactionId);
      
      res.json({
        status: 'success',
        message: `🚀 Транзакция #${transactionId} добавлена для СУПЕР-отслеживания с визуальными эффектами! ✨`,
        trackType: 'super'
      });
    } else {
      // Используем стандартное отслеживание
      await trackTransaction(transactionId);
      
      res.json({
        status: 'success',
        message: `Транзакция #${transactionId} добавлена для отслеживания`,
        trackType: 'standard'
      });
    }
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
        code: error.errorCode
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: (error as Error).message
      });
    }
  }
});

/**
 * Исправляет зависшие транзакции
 * POST /api/diagnostics/transactions/fix-stuck
 */
router.post('/transactions/fix-stuck', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Используем супер эффекты при исправлении транзакций
    const useSuper = req.query.super === 'true' || req.body.super === true;
    const result = await fixStuckTransactions();
    
    if (useSuper) {
      // Показываем ASCII-арт для успешно исправленных транзакций
      if (result.fixed && Array.isArray(result.fixed) && result.fixed.length > 0) {
        console.log(`
    ${COLORS.green}  ______ _               _   _ 
    ${COLORS.green} |  ____(_)             | | | |
    ${COLORS.green} | |__   ___  _____  ___| | | |
    ${COLORS.green} |  __| | \\ \\/ / _ \\/ __| | | |
    ${COLORS.green} | |    | |>  <  __/\\__ \\_| |_|
    ${COLORS.green} |_|    |_/_/\\_\\___||___(_) (_)
    ${COLORS.reset}
        `);
        
        // Печатаем информацию с эффектами
        for (const tx of (result.fixed || [])) {
          console.log(`${COLORS.cyan}${EMOJIS.sparkles} Исправлена транзакция #${tx.id} ${tx.type.includes('btc') ? EMOJIS.bitcoin : EMOJIS.ethereum} (${tx.amount})${COLORS.reset}`);
        }
      }
      
      res.json({
        status: 'success',
        data: result,
        message: `🛠️ УСПЕХ! Исправлено ${(result.fixed && Array.isArray(result.fixed)) ? result.fixed.length : 0} транзакций! ${(result.fixed && Array.isArray(result.fixed) && result.fixed.length > 0) ? '🎉' : ''}`,
        fixType: 'super'
      });
    } else {
      res.json({
        status: 'success',
        data: result
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message
    });
  }
});

/**
 * Проверяет доступность BlockDaemon API
 * GET /api/diagnostics/blockchain-api
 */
router.get('/blockchain-api', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await checkBlockDaemonApiAccess();
    
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message
    });
  }
});

export default router;