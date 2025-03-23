/**
 * Модуль для генерации и управления мнемоническими фразами (seed phrases) для криптовалютных кошельков
 * Используется для создания и восстановления BTC и ETH адресов
 */
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { HDNode } from '@ethersproject/hdnode';
import { validateMnemonic } from 'bip39';

// Пути деривации для разных криптовалют
const DERIVATION_PATHS = {
  btc: "m/44'/0'/0'/0/0",     // BIP44 для Bitcoin
  eth: "m/44'/60'/0'/0/0"     // BIP44 для Ethereum
};

/**
 * Генерирует новую мнемоническую фразу из 12 слов
 * @returns {string} Мнемоническая фраза
 */
export function generateMnemonic(): string {
  return bip39.generateMnemonic(128); // 128 бит = 12 слов
}

/**
 * Валидирует корректность мнемонической фразы
 * @param {string} mnemonic Мнемоническая фраза для проверки
 * @returns {boolean} true если фраза валидна, false если нет
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic);
}

/**
 * Генерирует Bitcoin-адрес из мнемонической фразы
 * @param {string} mnemonic Мнемоническая фраза
 * @returns {string} Bitcoin-адрес
 */
export function getBitcoinAddressFromMnemonic(mnemonic: string): string {
  // Используем модуль ECPair для создания Bitcoin кошелька
  try {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    // Создаем приватный ключ из seed
    const hash = require('crypto').createHash('sha256').update(seed).digest();
    const ECPair = require('ecpair').ECPairFactory(require('tiny-secp256k1'));
    const keyPair = ECPair.fromPrivateKey(hash);
    
    // Создаем Bitcoin адрес
    const { address } = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey,
      network: bitcoin.networks.bitcoin
    });
    
    if (!address) {
      throw new Error('Не удалось сгенерировать Bitcoin-адрес');
    }
    
    return address;
  } catch (error) {
    console.error('Ошибка при генерации Bitcoin адреса из мнемонической фразы:', error);
    throw error;
  }
}

/**
 * Генерирует Ethereum-адрес из мнемонической фразы
 * @param {string} mnemonic Мнемоническая фраза
 * @returns {string} Ethereum-адрес
 */
export function getEthereumAddressFromMnemonic(mnemonic: string): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdNode = HDNode.fromSeed(seed);
  const path = DERIVATION_PATHS.eth;
  const wallet = hdNode.derivePath(path);
  
  return wallet.address;
}

/**
 * Генерирует криптовалютные адреса из мнемонической фразы
 * @param {string} mnemonic Мнемоническая фраза
 * @returns {{ btcAddress: string, ethAddress: string }} Объект с адресами
 */
export function getAddressesFromMnemonic(mnemonic: string): { btcAddress: string, ethAddress: string } {
  if (!isValidMnemonic(mnemonic)) {
    throw new Error('Невалидная мнемоническая фраза');
  }
  
  const btcAddress = getBitcoinAddressFromMnemonic(mnemonic);
  const ethAddress = getEthereumAddressFromMnemonic(mnemonic);
  
  return { btcAddress, ethAddress };
}

/**
 * Генерирует детерминированную мнемоническую фразу на основе ID пользователя
 * @param {number} userId ID пользователя
 * @returns {string} Мнемоническая фраза
 */
export function generateDeterministicMnemonicFromUserId(userId: number): string {
  // Используем специальную соль для дополнительной безопасности 
  // (можно сделать это более безопасным, храня соль в окружении)
  const salt = 'BNAL_BANK_SECURE_SALT';
  
  // Комбинируем userId и соль для создания детерминированной фразы
  const combinedInput = `${userId}${salt}${userId * 1337}`;
  
  // Создаем seed из этого входного значения
  const seed = Buffer.from(combinedInput, 'utf8');
  
  // Генерируем энтропию подходящего размера для BIP39
  let entropy = Buffer.alloc(16); // 16 байт = 128 бит = 12 слов
  
  // Заполняем энтропию детерминистическим образом
  for (let i = 0; i < 16; i++) {
    entropy[i] = seed[i % seed.length];
  }
  
  // Генерируем мнемоническую фразу из этой энтропии
  return bip39.entropyToMnemonic(entropy);
}

/**
 * Получает криптовалютные адреса для пользователя на основе его ID
 * @param {number} userId ID пользователя
 * @returns {{ mnemonic: string, btcAddress: string, ethAddress: string }} Мнемоническая фраза и адреса
 */
export function generateAddressesForUser(userId: number): { mnemonic: string, btcAddress: string, ethAddress: string } {
  // Генерируем детерминированную мнемоническую фразу для пользователя
  const mnemonic = generateDeterministicMnemonicFromUserId(userId);
  
  // Получаем адреса из мнемонической фразы
  const { btcAddress, ethAddress } = getAddressesFromMnemonic(mnemonic);
  
  return { mnemonic, btcAddress, ethAddress };
}