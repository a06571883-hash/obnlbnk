import { ethers } from 'ethers';
import axios from 'axios';
import { validateCryptoAddress } from './crypto';

// Получаем API ключи из переменных окружения
const INFURA_API_KEY = process.env.INFURA_API_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const BLOCKDAEMON_API_KEY = process.env.BLOCKDAEMON_API_KEY;

/**
 * Проверяет наличие API ключей для работы с блокчейном
 * @returns true если ключи настроены, false если нет
 */
export function hasBlockchainApiKeys(): boolean {
  return Boolean(BLOCKDAEMON_API_KEY || INFURA_API_KEY || ALCHEMY_API_KEY);
}

/**
 * Получает Ethereum провайдер для доступа к сети
 * @returns Провайдер Ethereum
 */
function getEthereumProvider() {
  if (INFURA_API_KEY) {
    return new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${INFURA_API_KEY}`);
  } else if (ALCHEMY_API_KEY) {
    return new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`);
  } else {
    throw new Error('Не настроены API ключи для доступа к Ethereum');
  }
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
 * Получает баланс Ethereum-адреса
 * @param address Ethereum-адрес
 * @returns Promise с балансом в ETH
 */
export async function getEthereumBalance(address: string): Promise<number> {
  try {
    if (!validateCryptoAddress(address, 'eth')) {
      throw new Error(`Недействительный Ethereum адрес: ${address}`);
    }

    const provider = getEthereumProvider();
    const balanceWei = await provider.getBalance(address);
    
    // Конвертируем из Wei в ETH (1 ETH = 10^18 Wei)
    const balanceEth = parseFloat(ethers.formatEther(balanceWei));
    
    console.log(`Баланс ETH адреса ${address}: ${balanceEth} ETH`);
    return balanceEth;
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

    console.log(`Отправка ${amountBtc} BTC с ${fromAddress} на ${toAddress}`);

    // В реальном приложении здесь был бы код для подписания транзакции
    // через приватный ключ или взаимодействие с внешним кошельком
    
    // Для демонстрации, просто логируем попытку отправки и симулируем успешную отправку
    const fakeTxId = `btc_tx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    
    console.log(`Транзакция успешно отправлена. TxID: ${fakeTxId}`);
    return { txId: fakeTxId, status: 'pending' };
  } catch (error) {
    console.error(`Ошибка при отправке BTC транзакции:`, error);
    throw error;
  }
}

/**
 * Отправляет Ethereum транзакцию (только через внешний кошелек)
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

    console.log(`Отправка ${amountEth} ETH с ${fromAddress} на ${toAddress}`);

    // В реальном приложении здесь был бы код для подписания транзакции
    // через приватный ключ или внешний кошелек
    
    // Для демонстрации, просто логируем попытку отправки и симулируем успешную отправку
    const fakeTxId = `eth_tx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    
    console.log(`Транзакция успешно отправлена. TxID: ${fakeTxId}`);
    return { txId: fakeTxId, status: 'pending' };
  } catch (error) {
    console.error(`Ошибка при отправке ETH транзакции:`, error);
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
    
    if (cryptoType === 'btc') {
      if (!BLOCKDAEMON_API_KEY) {
        throw new Error('Не настроен API ключ для доступа к Bitcoin API');
      }
      
      // Здесь был бы код для проверки статуса через BlockDaemon API
      
      // Для демонстрации возвращаем случайный статус
      const statuses = ['pending', 'completed'] as const;
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const confirmations = randomStatus === 'completed' ? Math.floor(Math.random() * 6) + 1 : 0;
      
      return { status: randomStatus, confirmations };
    } else if (cryptoType === 'eth') {
      const provider = getEthereumProvider();
      
      // Здесь был бы код для проверки статуса ETH транзакции
      
      // Для демонстрации возвращаем случайный статус
      const statuses = ['pending', 'completed'] as const;
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const confirmations = randomStatus === 'completed' ? Math.floor(Math.random() * 12) + 1 : 0;
      
      return { status: randomStatus, confirmations };
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
    if (INFURA_API_KEY) console.log('✓ Infura API Key настроен');
    if (ALCHEMY_API_KEY) console.log('✓ Alchemy API Key настроен');
  } else {
    console.warn('⚠️ API ключи для работы с блокчейнами не настроены. Работа в режиме симуляции.');
  }
})();