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
    startTransactionMonitoring();
    
    res.json({
      status: 'success',
      message: 'Мониторинг транзакций запущен'
    });
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
    const pendingTransactions = getPendingTransactions();
    
    res.json({
      status: 'success',
      data: pendingTransactions
    });
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
    
    const result = await checkTransaction(transactionId);
    
    if (!result) {
      throw new NotFoundError(`Транзакция #${transactionId} не найдена`);
    }
    
    res.json({
      status: 'success',
      data: result
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
    
    await trackTransaction(transactionId);
    
    res.json({
      status: 'success',
      message: `Транзакция #${transactionId} добавлена для отслеживания`
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
 * Исправляет зависшие транзакции
 * POST /api/diagnostics/transactions/fix-stuck
 */
router.post('/transactions/fix-stuck', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await fixStuckTransactions();
    
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