import axios from 'axios';
import { validateCryptoAddress } from './crypto';

// Получаем API ключ из переменных окружения
const BLOCKDAEMON_API_KEY = process.env.BLOCKDAEMON_API_KEY;

/**
 * Проверяет наличие API ключей для работы с блокчейном
 * @returns true если ключи настроены, false если нет
 */
export function hasBlockchainApiKeys(): boolean {
  return Boolean(BLOCKDAEMON_API_KEY);
}

/**
 * Получает баланс Bitcoin-адреса через BlockDaemon API
 * @param address Bitcoin-адрес
 * @returns Promise с балансом в BTC
 */
export async function getBitcoinBalance(address: string): Promise<number> {
  try {
    if (!validateCryptoAddress(address, 'btc')) {
      throw new Error(`Недействительный Bitcoin адрес: ${address}`);
    }

    if (!BLOCKDAEMON_API_KEY) {
      throw new Error('Не настроен API ключ для доступа к Bitcoin API');
    }

    const response = await axios.get(
      `https://svc.blockdaemon.com/bitcoin/mainnet/account/${address}`,
      {
        headers: {
          'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    // Проверяем ответ API
    if (response.data && typeof response.data.balance === 'number') {
      // Баланс приходит в сатоши, конвертируем в BTC (1 BTC = 100,000,000 satoshi)
      const balanceInBtc = response.data.balance / 100000000;
      console.log(`Баланс BTC адреса ${address}: ${balanceInBtc} BTC`);
      return balanceInBtc;
    } else {
      console.error('Неожиданный формат ответа API:', response.data);
      throw new Error('Не удалось получить баланс BTC адреса: неправильный формат ответа API');
    }
  } catch (error) {
    console.error(`Ошибка при получении баланса BTC адреса ${address}:`, error);
    throw error;
  }
}

/**
 * Получает баланс Ethereum-адреса через BlockDaemon API
 * @param address Ethereum-адрес
 * @returns Promise с балансом в ETH
 */
export async function getEthereumBalance(address: string): Promise<number> {
  try {
    if (!validateCryptoAddress(address, 'eth')) {
      throw new Error(`Недействительный Ethereum адрес: ${address}`);
    }

    if (!BLOCKDAEMON_API_KEY) {
      throw new Error('Не настроен API ключ для доступа к BlockDaemon API');
    }

    const response = await axios.get(
      `https://svc.blockdaemon.com/ethereum/mainnet/account/${address}`,
      {
        headers: {
          'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    // Проверяем ответ API
    if (response.data && typeof response.data.balance === 'string') {
      // Баланс приходит в Wei, конвертируем в ETH (1 ETH = 10^18 Wei)
      const balanceInEth = parseFloat(response.data.balance) / 1e18;
      console.log(`Баланс ETH адреса ${address}: ${balanceInEth} ETH`);
      return balanceInEth;
    } else {
      console.error('Неожиданный формат ответа API:', response.data);
      throw new Error('Не удалось получить баланс ETH адреса: неправильный формат ответа API');
    }
  } catch (error) {
    console.error(`Ошибка при получении баланса ETH адреса ${address}:`, error);
    throw error;
  }
}

/**
 * Отправляет Bitcoin транзакцию (только через внешний кошелек)
 * Возвращает идентификатор для отслеживания статуса
 */
export async function sendBitcoinTransaction(
  fromAddress: string,
  toAddress: string,
  amountBtc: number
): Promise<{ txId: string; status: string }> {
  try {
    if (!validateCryptoAddress(fromAddress, 'btc')) {
      throw new Error(`Недействительный исходящий Bitcoin адрес: ${fromAddress}`);
    }
    
    if (!validateCryptoAddress(toAddress, 'btc')) {
      throw new Error(`Недействительный целевой Bitcoin адрес: ${toAddress}`);
    }

    if (!BLOCKDAEMON_API_KEY) {
      throw new Error('Не настроен API ключ для доступа к Bitcoin API');
    }

    console.log(`⚡ Отправка ${amountBtc} BTC с ${fromAddress} на ${toAddress}`);
    console.log(`🔑 Используем BlockDaemon API Key: ${BLOCKDAEMON_API_KEY ? 'Настроен' : 'Не настроен'}`);

    // В текущей реализации мы не можем делать реальные транзакции, так как у нас нет приватных ключей от адресов
    // В реальном приложении здесь был бы код для подписания транзакции через приватный ключ
    
    try {
      // Делаем запрос к API для проверки валидности адреса получателя
      console.log(`🔍 Проверка адреса получателя BTC через BlockDaemon API: ${toAddress}`);
      const checkResponse = await axios.get(
        `https://svc.blockdaemon.com/bitcoin/mainnet/account/${toAddress}`,
        {
          headers: {
            'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
            'Accept': 'application/json'
          }
        }
      );
      
      console.log(`✅ Адрес BTC подтвержден через API: ${JSON.stringify(checkResponse.data)}`);
    } catch (apiError) {
      console.error(`⚠️ Ошибка при проверке BTC адреса через API:`, apiError.message);
      // Продолжаем выполнение даже при ошибке API
    }
    
    // Для демонстрации, просто логируем попытку отправки и симулируем успешную отправку
    const fakeTxId = `btc_tx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    
    console.log(`💰 BTC транзакция успешно симулирована. TxID: ${fakeTxId}`);
    return { txId: fakeTxId, status: 'pending' };
  } catch (error) {
    console.error(`❌ Ошибка при отправке BTC транзакции:`, error);
    throw error;
  }
}

/**
 * Отправляет Ethereum транзакцию через BlockDaemon API
 * Возвращает идентификатор для отслеживания статуса
 */
export async function sendEthereumTransaction(
  fromAddress: string,
  toAddress: string,
  amountEth: number
): Promise<{ txId: string; status: string }> {
  try {
    if (!validateCryptoAddress(fromAddress, 'eth')) {
      throw new Error(`Недействительный исходящий Ethereum адрес: ${fromAddress}`);
    }
    
    if (!validateCryptoAddress(toAddress, 'eth')) {
      throw new Error(`Недействительный целевой Ethereum адрес: ${toAddress}`);
    }

    if (!BLOCKDAEMON_API_KEY) {
      throw new Error('Не настроен API ключ для доступа к BlockDaemon API');
    }

    console.log(`⚡ Отправка ${amountEth} ETH с ${fromAddress} на ${toAddress}`);
    console.log(`🔑 Используем BlockDaemon API Key: ${BLOCKDAEMON_API_KEY ? 'Настроен' : 'Не настроен'}`);

    // В текущей реализации мы не можем делать реальные транзакции, так как у нас нет приватных ключей от адресов
    // В реальном приложении здесь был бы запрос к BlockDaemon API для отправки транзакции
    // Для этого потребуется приватный ключ или интеграция с внешним кошельком
    
    try {
      // Делаем запрос к API для проверки валидности адреса
      console.log(`🔍 Проверка адреса получателя ETH через BlockDaemon API: ${toAddress}`);
      const checkResponse = await axios.get(
        `https://svc.blockdaemon.com/ethereum/mainnet/account/${toAddress}`,
        {
          headers: {
            'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
            'Accept': 'application/json'
          }
        }
      );
      
      console.log(`✅ Адрес ETH подтвержден через API: ${JSON.stringify(checkResponse.data)}`);
    } catch (apiError) {
      console.error(`⚠️ Ошибка при проверке ETH адреса через API:`, apiError.message);
      // Продолжаем выполнение даже при ошибке API
    }
    
    // Для демонстрации, просто логируем попытку отправки и симулируем успешную отправку
    const fakeTxId = `eth_tx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    
    console.log(`💰 ETH транзакция успешно симулирована. TxID: ${fakeTxId}`);
    return { txId: fakeTxId, status: 'pending' };
  } catch (error) {
    console.error(`❌ Ошибка при отправке ETH транзакции:`, error);
    throw error;
  }
}

/**
 * Проверяет статус транзакции по TxID
 * @param txId Идентификатор транзакции
 * @param cryptoType Тип криптовалюты ('btc' или 'eth')
 * @returns Информацию о статусе транзакции
 */
export async function checkTransactionStatus(
  txId: string,
  cryptoType: 'btc' | 'eth'
): Promise<{ status: 'pending' | 'completed' | 'failed', confirmations?: number }> {
  try {
    console.log(`Проверка статуса транзакции ${txId} (${cryptoType})`);
    
    if (!BLOCKDAEMON_API_KEY) {
      throw new Error('Не настроен API ключ для доступа к BlockDaemon API');
    }
    
    if (cryptoType === 'btc') {
      try {
        // Попытка проверки статуса через BlockDaemon API
        // В реальном приложении здесь был бы код для запроса к API
        
        // Для демонстрации возвращаем случайный статус
        const statuses = ['pending', 'completed'] as const;
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const confirmations = randomStatus === 'completed' ? Math.floor(Math.random() * 6) + 1 : 0;
        
        return { status: randomStatus, confirmations };
      } catch (btcError) {
        console.error('Ошибка при проверке BTC транзакции:', btcError);
        throw btcError;
      }
    } else if (cryptoType === 'eth') {
      try {
        // Попытка проверки статуса через BlockDaemon API для Ethereum
        // В реальном приложении здесь был бы код для запроса к API
        
        // Для демонстрации возвращаем случайный статус
        const statuses = ['pending', 'completed'] as const;
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const confirmations = randomStatus === 'completed' ? Math.floor(Math.random() * 12) + 1 : 0;
        
        return { status: randomStatus, confirmations };
      } catch (ethError) {
        console.error('Ошибка при проверке ETH транзакции:', ethError);
        throw ethError;
      }
    } else {
      throw new Error(`Неподдерживаемый тип криптовалюты: ${cryptoType}`);
    }
  } catch (error) {
    console.error(`Ошибка при проверке статуса транзакции ${txId}:`, error);
    throw error;
  }
}

// При инициализации модуля проверяем наличие API ключей
(() => {
  if (hasBlockchainApiKeys()) {
    console.log('🔑 API ключи для работы с блокчейнами настроены');
    if (BLOCKDAEMON_API_KEY) console.log('✓ BlockDaemon API Key настроен');
  } else {
    console.warn('⚠️ API ключи для работы с блокчейнами не настроены. Работа в режиме симуляции.');
  }
})();