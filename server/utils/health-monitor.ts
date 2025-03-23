/**
 * Модуль для мониторинга состояния приложения в реальном времени
 * Отслеживает ключевые метрики и собирает информацию о системе
 */

import os from 'os';
import { EventEmitter } from 'events';
import { client } from '../db';
import { hasBlockchainApiKeys } from './blockchain';

// Интерфейс для объекта состояния здоровья системы
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  environment: string;
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
  };
  cpu: {
    loadAvg: number[];
    usagePercent: number;
  };
  apiKeys: {
    blockchain: boolean;
  };
  database: {
    connected: boolean;
    connectionPool: number;
  };
  errors: {
    count: number;
    recent: Array<{
      timestamp: string;
      message: string;
      type: string;
    }>;
  };
}

// Класс для мониторинга здоровья системы
class HealthMonitor extends EventEmitter {
  private static instance: HealthMonitor;
  private healthStatus: HealthStatus;
  private errorLog: Array<{timestamp: string; message: string; type: string}> = [];
  private maxErrors = 100; // Максимальное количество хранимых ошибок
  private databaseConnectionChecked = false;
  
  private constructor() {
    super();
    
    // Инициализируем начальное состояние
    this.healthStatus = {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      memory: this.getMemoryInfo(),
      cpu: this.getCpuInfo(),
      apiKeys: {
        blockchain: hasBlockchainApiKeys().available
      },
      database: {
        connected: false,
        connectionPool: 0
      },
      errors: {
        count: 0,
        recent: []
      }
    };
    
    // Запускаем периодический мониторинг
    this.startMonitoring();
  }
  
  // Singleton паттерн
  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }
  
  /**
   * Запускает мониторинг системы
   */
  private startMonitoring(): void {
    // Обновляем данные каждые 30 секунд
    setInterval(() => this.updateHealthStatus(), 30000);
    
    // Сразу запускаем первую проверку
    this.updateHealthStatus();
    
    // Проверяем соединение с базой данных
    this.checkDatabaseConnection();
  }
  
  /**
   * Получает информацию о памяти системы
   */
  private getMemoryInfo(): HealthStatus['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usedPercent = Math.round((used / total) * 100);
    
    return { total, free, used, usedPercent };
  }
  
  /**
   * Получает информацию о CPU системы
   */
  private getCpuInfo(): HealthStatus['cpu'] {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    // Упрощенный расчет загрузки CPU (первая цифра из loadavg / количество ядер)
    const usagePercent = Math.min(Math.round((loadAvg[0] / cpuCount) * 100), 100);
    
    return { loadAvg, usagePercent };
  }
  
  /**
   * Проверяет соединение с базой данных
   */
  private async checkDatabaseConnection(): Promise<void> {
    try {
      if (!this.databaseConnectionChecked) {
        console.log('Проверка соединения с базой данных...');
      }
      
      // Получаем информацию о пуле соединений
      const result = await client`SELECT 1 as connected`;
      
      // Обновляем статус соединения
      this.healthStatus.database.connected = Boolean(result && result.length > 0);
      
      // Информация о пуле недоступна напрямую, используем 1 как значение по умолчанию
      this.healthStatus.database.connectionPool = 1;
      
      if (!this.databaseConnectionChecked) {
        console.log('Соединение с базой данных: ✅ Подключено');
        this.databaseConnectionChecked = true;
      }
    } catch (error) {
      this.healthStatus.database.connected = false;
      
      if (!this.databaseConnectionChecked) {
        console.error('Ошибка при проверке соединения с базой данных:', error);
        this.databaseConnectionChecked = true;
      }
      
      // Добавляем ошибку в лог
      this.logError('DatabaseConnectionError', (error as Error).message);
    }
  }
  
  /**
   * Обновляет статус здоровья системы
   */
  private async updateHealthStatus(): Promise<void> {
    // Обновляем базовые метрики
    this.healthStatus.uptime = process.uptime();
    this.healthStatus.timestamp = new Date().toISOString();
    this.healthStatus.memory = this.getMemoryInfo();
    this.healthStatus.cpu = this.getCpuInfo();
    
    // Проверяем API ключи
    this.healthStatus.apiKeys.blockchain = hasBlockchainApiKeys().available;
    
    // Проверяем соединение с базой данных
    await this.checkDatabaseConnection();
    
    // Определяем общий статус здоровья
    this.determineHealthStatus();
    
    // Отправляем обновленный статус через событие
    this.emit('health-updated', this.getStatus());
  }
  
  /**
   * Определяет общий статус здоровья системы
   */
  private determineHealthStatus(): void {
    const { memory, database, errors } = this.healthStatus;
    
    // Правила для определения статуса
    if (
      memory.usedPercent >= 90 || 
      !database.connected || 
      errors.count >= 10
    ) {
      this.healthStatus.status = 'unhealthy';
    } else if (
      memory.usedPercent >= 75 || 
      errors.count >= 5
    ) {
      this.healthStatus.status = 'degraded';
    } else {
      this.healthStatus.status = 'healthy';
    }
  }
  
  /**
   * Логирует ошибку в мониторе здоровья
   */
  public logError(type: string, message: string): void {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      type,
      message
    };
    
    // Добавляем ошибку в начало массива
    this.errorLog.unshift(errorEntry);
    
    // Ограничиваем размер лога ошибок
    if (this.errorLog.length > this.maxErrors) {
      this.errorLog = this.errorLog.slice(0, this.maxErrors);
    }
    
    // Обновляем статистику ошибок
    this.healthStatus.errors.count += 1;
    this.healthStatus.errors.recent = this.errorLog.slice(0, 5);
    
    // Переопределяем статус здоровья
    this.determineHealthStatus();
    
    // Отправляем уведомление о новой ошибке
    this.emit('error-logged', errorEntry);
    
    // Отправляем обновленный статус через событие
    this.emit('health-updated', this.getStatus());
  }
  
  /**
   * Возвращает текущий статус здоровья системы
   */
  public getStatus(): HealthStatus {
    return { ...this.healthStatus };
  }
  
  /**
   * Возвращает все залогированные ошибки
   */
  public getErrorLog(): Array<{timestamp: string; message: string; type: string}> {
    return [...this.errorLog];
  }
  
  /**
   * Очищает лог ошибок
   */
  public clearErrorLog(): void {
    this.errorLog = [];
    this.healthStatus.errors.count = 0;
    this.healthStatus.errors.recent = [];
    
    // Переопределяем статус здоровья
    this.determineHealthStatus();
    
    // Отправляем обновленный статус через событие
    this.emit('health-updated', this.getStatus());
  }
}

// Экспортируем синглтон
export const healthMonitor = HealthMonitor.getInstance();

/**
 * Получает текущий статус здоровья системы
 */
export function getSystemHealth(): HealthStatus {
  return healthMonitor.getStatus();
}

/**
 * Логирует ошибку в мониторе здоровья
 */
export function logSystemError(type: string, message: string): void {
  healthMonitor.logError(type, message);
}

/**
 * Очищает лог ошибок системы
 */
export function clearSystemErrorLog(): void {
  healthMonitor.clearErrorLog();
}

// Подписываемся на события мониторинга для отладки
if (process.env.NODE_ENV === 'development') {
  healthMonitor.on('health-updated', (status) => {
    if (status.status !== 'healthy') {
      console.log(`Статус здоровья системы изменился: ${status.status}`);
    }
  });
  
  healthMonitor.on('error-logged', (error) => {
    console.log(`Новая ошибка в мониторе здоровья: ${error.type} - ${error.message}`);
  });
}

// Экспортируем интерфейс и основные функции
export default {
  getSystemHealth,
  logSystemError,
  clearSystemErrorLog,
  healthMonitor
};