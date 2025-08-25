/**
 * Модуль для автоматического решения распространенных проблем приложения
 * Включает диагностику, поиск проблем и их исправление
 */

import axios from 'axios';
import { AppError, logError } from './error-handler';
import { withDatabaseRetry } from './new_modules/db';
import * as schema from '../../shared/schema';
import { client, db } from './new_modules/db';

/**
 * Проверяет доступность BlockDaemon API
 * @returns Результаты проверки
 */
export async function checkBlockDaemonApiAccess(): Promise<{
  available: boolean;
  message: string;
  details?: any;
}> {
  try {
    const BLOCKDAEMON_API_KEY = process.env.BLOCKDAEMON_API_KEY;
    
    if (!BLOCKDAEMON_API_KEY) {
      return {
        available: false,
        message: 'BlockDaemon API ключ не найден в переменных окружения',
        details: {
          environmentVariables: Object.keys(process.env).filter(key => 
            key.includes('BLOCK') || 
            key.includes('API') || 
            key.includes('KEY')
          )
        }
      };
    }
    
    // Пробуем сделать простой запрос к API для проверки доступности
    const response = await axios.get(
      'https://svc.blockdaemon.com/universal/v1/status',
      {
        headers: {
          'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      }
    );
    
    return {
      available: true,
      message: 'BlockDaemon API доступен',
      details: {
        status: response.status,
        apiVersion: response.data?.version || 'Неизвестно'
      }
    };
  } catch (error: any) {
    return {
      available: false,
      message: `Ошибка при проверке BlockDaemon API: ${error.message}`,
      details: {
        status: error.response?.status,
        data: error.response?.data,
        code: error.code
      }
    };
  }
}

/**
 * Проверяет подключение к базе данных PostgreSQL
 * @returns Результаты проверки
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  details?: any;
}> {
  try {
    // Пробуем выполнить простой запрос к базе данных
    const result = await withDatabaseRetry(
      async () => client`SELECT current_timestamp as now`, 
      'проверка подключения к базе данных', 
      2
    );
    
    return {
      connected: true,
      message: 'Успешное подключение к базе данных',
      details: {
        timestamp: result?.[0]?.now || 'Неизвестно',
        database: process.env.PGDATABASE || 'Неизвестно',
        host: process.env.PGHOST || 'Неизвестно'
      }
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Ошибка подключения к базе данных: ${error.message}`,
      details: {
        code: error.code,
        errorCode: error.errorCode,
        pgErrorDetail: error.details
      }
    };
  }
}

/**
 * Проверяет наличие проблем с криптоадресами в базе данных
 * @returns Результаты проверки
 */
export async function checkCryptoAddresses(): Promise<{
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: any;
}> {
  try {
    // Находим все криптокарты
    const cards = await withDatabaseRetry(
      async () => db.select().from(schema.cards).where(sql => sql.eq(schema.cards.type, 'crypto')),
      'получение списка криптокарт',
      2
    );
    
    if (!cards || cards.length === 0) {
      return {
        status: 'warning',
        message: 'Криптокарты не найдены в базе данных',
        details: { cardsCount: 0 }
      };
    }
    
    // Проверяем криптоадреса
    const invalidCards = cards.filter(card => {
      const hasBtcAddress = Boolean(card.btcAddress && card.btcAddress.length >= 26 && card.btcAddress.length <= 35);
      const hasEthAddress = Boolean(card.ethAddress && card.ethAddress.length === 42 && card.ethAddress.startsWith('0x'));
      
      return !(hasBtcAddress && hasEthAddress);
    });
    
    if (invalidCards.length > 0) {
      return {
        status: 'error',
        message: `Найдены ${invalidCards.length} криптокарт с недействительными адресами`,
        details: {
          totalCards: cards.length,
          invalidCards: invalidCards.length,
          examples: invalidCards.slice(0, 3).map(card => ({
            id: card.id,
            btcAddress: card.btcAddress ? card.btcAddress.substring(0, 10) + '...' : 'Отсутствует',
            ethAddress: card.ethAddress ? card.ethAddress.substring(0, 10) + '...' : 'Отсутствует'
          }))
        }
      };
    }
    
    return {
      status: 'ok',
      message: `Все ${cards.length} криптокарт имеют действительные адреса`,
      details: {
        cardsCount: cards.length
      }
    };
  } catch (error: any) {
    return {
      status: 'error',
      message: `Ошибка при проверке криптоадресов: ${error.message}`,
      details: {
        code: error.code,
        errorCode: error.errorCode
      }
    };
  }
}

/**
 * Проверяет и исправляет зависшие транзакции
 * @returns Результаты исправления
 */
export async function fixStuckTransactions(): Promise<{
  fixed: boolean;
  message: string;
  details?: any;
}> {
  try {
    // Находим все "зависшие" транзакции (в статусе pending более 24 часов)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const stuckTransactions = await withDatabaseRetry(
      async () => db.select().from(schema.transactions)
        .where(sql => sql.and(
          sql.eq(schema.transactions.status, 'pending'),
          sql.lt(schema.transactions.createdAt, oneDayAgo)
        )),
      'поиск зависших транзакций',
      2
    );
    
    if (!stuckTransactions || stuckTransactions.length === 0) {
      return {
        fixed: true,
        message: 'Зависшие транзакции не найдены',
        details: { count: 0 }
      };
    }
    
    console.log(`🔍 Найдено ${stuckTransactions.length} зависших транзакций...`);
    
    // Исправляем зависшие транзакции
    const results = [];
    
    for (const tx of stuckTransactions) {
      try {
        // Для ETH транзакций автоматически завершаем
        if (tx.type === 'eth' || tx.type === 'eth_transfer') {
          await withDatabaseRetry(
            async () => db.update(schema.transactions)
              .set({ status: 'completed' })
              .where(sql => sql.eq(schema.transactions.id, tx.id)),
            `обновление статуса транзакции ${tx.id}`,
            2
          );
          
          console.log(`✅ Транзакция #${tx.id} (ETH) успешно завершена`);
          results.push({ id: tx.id, type: tx.type, status: 'completed', success: true });
        }
        // Для BTC транзакций проверяем возможность автоматического завершения
        else if (tx.type === 'btc' || tx.type === 'btc_transfer') {
          // Проверяем, начинается ли txId с btc_tx
          if (tx.wallet && tx.wallet.startsWith('btc_tx_')) {
            await withDatabaseRetry(
              async () => db.update(schema.transactions)
                .set({ status: 'completed' })
                .where(sql => sql.eq(schema.transactions.id, tx.id)),
              `обновление статуса транзакции ${tx.id}`,
              2
            );
            
            console.log(`✅ Транзакция #${tx.id} (BTC) успешно завершена`);
            results.push({ id: tx.id, type: tx.type, status: 'completed', success: true });
          } else {
            console.log(`⚠️ Транзакция #${tx.id} (BTC) не может быть автоматически завершена (требуется проверка blockchain)`);
            results.push({ id: tx.id, type: tx.type, status: 'still_pending', success: false });
          }
        }
        // Для других типов транзакций оставляем как есть
        else {
          console.log(`⚠️ Транзакция #${tx.id} (${tx.type || 'Неизвестный тип'}) не может быть автоматически завершена`);
          results.push({ id: tx.id, type: tx.type, status: 'still_pending', success: false });
        }
      } catch (txError) {
        console.error(`❌ Ошибка при обработке транзакции #${tx.id}: ${(txError as Error).message}`);
        results.push({ id: tx.id, type: tx.type, status: 'error', success: false, error: (txError as Error).message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      fixed: successCount > 0,
      message: `Исправлено ${successCount} из ${stuckTransactions.length} зависших транзакций`,
      details: {
        total: stuckTransactions.length,
        success: successCount,
        results
      }
    };
  } catch (error: any) {
    return {
      fixed: false,
      message: `Ошибка при исправлении зависших транзакций: ${error.message}`,
      details: {
        code: error.code,
        errorCode: error.errorCode
      }
    };
  }
}

/**
 * Запускает автоматическую диагностику и исправление проблем
 * @returns Результаты диагностики и исправления
 */
export async function runDiagnostics(): Promise<{
  status: 'ok' | 'warning' | 'error';
  message: string;
  details: {
    api: any;
    database: any;
    cryptoAddresses: any;
    stuckTransactions: any;
  };
}> {
  try {
    console.log('🔍 Запуск автоматической диагностики системы...');
    
    // Проверяем API
    console.log('🔍 Проверка BlockDaemon API...');
    const apiStatus = await checkBlockDaemonApiAccess();
    
    // Проверяем базу данных
    console.log('🔍 Проверка подключения к базе данных...');
    const dbStatus = await checkDatabaseConnection();
    
    // Проверяем криптоадреса
    console.log('🔍 Проверка криптоадресов...');
    const addressesStatus = await checkCryptoAddresses();
    
    // Исправляем зависшие транзакции
    console.log('🔍 Проверка зависших транзакций...');
    const transactionsStatus = await fixStuckTransactions();
    
    // Определяем общий статус
    let status: 'ok' | 'warning' | 'error' = 'ok';
    
    if (!apiStatus.available || !dbStatus.connected || addressesStatus.status === 'error' || !transactionsStatus.fixed) {
      status = 'error';
    } else if (addressesStatus.status === 'warning') {
      status = 'warning';
    }
    
    // Формируем итоговое сообщение
    const messages = [];
    
    if (!apiStatus.available) messages.push('API недоступен');
    if (!dbStatus.connected) messages.push('Проблемы с базой данных');
    if (addressesStatus.status !== 'ok') messages.push(addressesStatus.message);
    if (!transactionsStatus.fixed) messages.push(transactionsStatus.message);
    
    const message = messages.length > 0 
      ? `Обнаружены проблемы: ${messages.join(', ')}` 
      : 'Система работает нормально';
    
    return {
      status,
      message,
      details: {
        api: apiStatus,
        database: dbStatus,
        cryptoAddresses: addressesStatus,
        stuckTransactions: transactionsStatus
      }
    };
  } catch (error: any) {
    logError(error);
    
    return {
      status: 'error',
      message: `Ошибка при диагностике системы: ${error.message}`,
      details: {
        api: { available: false, message: 'Ошибка диагностики' },
        database: { connected: false, message: 'Ошибка диагностики' },
        cryptoAddresses: { status: 'error', message: 'Ошибка диагностики' },
        stuckTransactions: { fixed: false, message: 'Ошибка диагностики' }
      }
    };
  }
}

// Экспортируем основные функции
export default {
  checkBlockDaemonApiAccess,
  checkDatabaseConnection,
  checkCryptoAddresses,
  fixStuckTransactions,
  runDiagnostics
};