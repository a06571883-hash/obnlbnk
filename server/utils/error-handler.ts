/**
 * Модуль для централизованной обработки ошибок приложения
 * Включает глобальные обработчики необработанных исключений,
 * улучшенное логгирование и отправку метрик для мониторинга
 */

import { Request, Response, NextFunction, Express } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Класс для расширенных ошибок с дополнительными полями
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode?: string;
  public details?: Record<string, any>;
  
  constructor(
    message: string, 
    statusCode: number = 500, 
    isOperational: boolean = true,
    errorCode?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    this.details = details;
    
    // Сохраняем корректный stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Добавляем дополнительную информацию
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Типы кастомных ошибок
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, true, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 500, true, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
  }
}

export class BlockchainError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 502, true, 'BLOCKCHAIN_ERROR', details);
    this.name = 'BlockchainError';
  }
}

/**
 * Форматирует ошибку для ответа клиенту
 * В продакшене скрывает технические детали
 */
const formatError = (err: AppError | Error, req: Request) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (err instanceof AppError) {
    return {
      status: 'error',
      code: err.errorCode || 'INTERNAL_ERROR',
      message: err.message,
      ...(isProduction ? {} : {
        path: req.path,
        timestamp: new Date().toISOString(),
        details: err.details,
        stack: err.stack
      })
    };
  }
  
  // Неизвестная ошибка
  return {
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: isProduction ? 'Внутренняя ошибка сервера' : err.message,
    ...(isProduction ? {} : {
      path: req.path,
      timestamp: new Date().toISOString(),
      stack: err.stack
    })
  };
};

/**
 * Логирует ошибку более подробно, чем стандартный console.error
 */
export const logError = (err: Error, req?: Request) => {
  const timestamp = new Date().toISOString();
  const errorDetails = {
    timestamp,
    message: err.message,
    stack: err.stack,
    ...((err as AppError).details || {}),
    ...(req ? {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      headers: req.headers,
      query: req.query,
      body: req.body
    } : {})
  };
  
  console.error('🔴 Error details:', JSON.stringify(errorDetails, null, 2));
  
  // Логирование в файл (дополнительно)
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
    const logEntry = `${timestamp} - ${JSON.stringify(errorDetails)}\n`;
    
    fs.appendFileSync(logFile, logEntry);
  } catch (logError) {
    console.error('Error writing to log file:', logError);
  }
  
  // Здесь можно добавить интеграцию с системами мониторинга
  // sendErrorToMonitoring(errorDetails);
};

/**
 * Обработчик ошибок для Express
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Логируем ошибку
  logError(err, req);
  
  // Приводим к AppError если это обычная ошибка
  const appError = err instanceof AppError 
    ? err 
    : new AppError(err.message || 'Внутренняя ошибка сервера');
  
  // Отправляем ответ
  res.status(appError.statusCode || 500).json(formatError(appError, req));
};

/**
 * Обработчик ошибок MongoDB
 */
export const handleDatabaseError = (err: any) => {
  if (err.code === 11000) {
    // Duplicate key error
    return new ValidationError('Запись с такими данными уже существует', {
      field: Object.keys(err.keyValue)[0],
      value: Object.values(err.keyValue)[0]
    });
  }
  
  return new DatabaseError(err.message, { 
    code: err.code,
    name: err.name
  });
};

/**
 * Устанавливает глобальные обработчики необработанных исключений
 */
export const setupGlobalErrorHandlers = () => {
  // Необработанные исключения в промисах
  process.on('unhandledRejection', (reason: Error) => {
    console.error('🔴 Unhandled Rejection:', reason);
    logError(reason);
    
    // Не завершаем процесс, но логируем для анализа
  });
  
  // Необработанные исключения
  process.on('uncaughtException', (error: Error) => {
    console.error('🔴 Uncaught Exception:', error);
    logError(error);
    
    // Для критических ошибок можно завершить процесс
    // Но из-за обработки в Replit, мы этого не делаем
    // process.exit(1);
  });
};

/**
 * Обработчик 404 ошибок
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route not found: ${req.originalUrl}`));
};

/**
 * Регистрирует все обработчики ошибок в Express приложении
 */
export const registerErrorHandlers = (app: Express) => {
  // Устанавливаем глобальные обработчики
  setupGlobalErrorHandlers();
  
  // Регистрируем обработчик 404
  app.use(notFoundHandler);
  
  // Регистрируем обработчик ошибок
  app.use(errorHandler);
};

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  DatabaseError,
  BlockchainError,
  errorHandler,
  notFoundHandler,
  registerErrorHandlers,
  logError,
  setupGlobalErrorHandlers,
  handleDatabaseError
};