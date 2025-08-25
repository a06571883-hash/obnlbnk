/**
 * Модуль для генерации и управления мнемоническими фразами (seed phrases) для криптовалютных кошельков
 * Используется для создания и восстановления BTC и ETH адресов
 */
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import HDWallet from 'ethereumjs-wallet';
import { ethers } from 'ethers';
// @ts-ignore
import HDKey from 'hdkey';

/**
 * Генерирует новую мнемоническую фразу из 12 слов
 * @returns {string} Мнемоническая фраза
 */
export function generateMnemonic(): string {
  return bip39.generateMnemonic();
}

/**
 * Валидирует корректность мнемонической фразы
 * @param {string} mnemonic Мнемоническая фраза для проверки
 * @returns {boolean} true если фраза валидна, false если нет
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Генерирует Bitcoin-адрес из мнемонической фразы
 * @param {string} mnemonic Мнемоническая фраза
 * @returns {string} Bitcoin-адрес
 */
export async function getBitcoinAddressFromMnemonic(mnemonic: string): Promise<string> {
  try {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdMaster = HDKey.fromMasterSeed(seed);
    const childKey = hdMaster.derive("m/44'/0'/0'/0/0");
    
    // Инициализируем ECPair с поддержкой tiny-secp256k1
    const ecc = require('tiny-secp256k1');
    const ECPairFactory = require('ecpair');
    const ECPair = ECPairFactory.default ? ECPairFactory.default(ecc) : ECPairFactory(ecc);
    
    // Создаем пару ключей из приватного ключа
    const keyPair = ECPair.fromPrivateKey(Buffer.from(childKey.privateKey));
    
    // Генерируем P2PKH адрес (начинается с 1)
    const { address } = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey 
    });
    
    return address || '';
  } catch (error) {
    console.error('Failed to generate Bitcoin address from mnemonic:', error);
    return '';
  }
}

/**
 * Генерирует Ethereum-адрес из мнемонической фразы
 * @param {string} mnemonic Мнемоническая фраза
 * @returns {string} Ethereum-адрес
 */
export function getEthereumAddressFromMnemonic(mnemonic: string): string {
  try {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdkey = HDKey.fromMasterSeed(seed);
    const childKey = hdkey.derive("m/44'/60'/0'/0/0");
    
    // Создаем кошелек из приватного ключа
    const wallet = HDWallet.fromPrivateKey(Buffer.from(childKey.privateKey));
    const address = `0x${wallet.getAddress().toString('hex')}`;
    
    // Форматируем адрес в правильном регистре (чексумма)
    return ethers.getAddress(address);
  } catch (error) {
    console.error('Failed to generate Ethereum address from mnemonic:', error);
    return '';
  }
}

/**
 * Генерирует криптовалютные адреса из мнемонической фразы
 * @param {string} mnemonic Мнемоническая фраза
 * @returns {{ btcAddress: string, ethAddress: string }} Объект с адресами
 */
export async function getAddressesFromMnemonic(mnemonic: string): Promise<{ btcAddress: string, ethAddress: string }> {
  const btcAddress = await getBitcoinAddressFromMnemonic(mnemonic);
  const ethAddress = getEthereumAddressFromMnemonic(mnemonic);
  
  return { btcAddress, ethAddress };
}

/**
 * Генерирует детерминированную мнемоническую фразу на основе ID пользователя
 * @param {number} userId ID пользователя
 * @returns {string} Мнемоническая фраза
 */
export function generateDeterministicMnemonicFromUserId(userId: number): string {
  // Создаем "энтропию" на основе ID пользователя
  // В реальном приложении надо использовать более надежный метод
  const entropy = Buffer.alloc(16);
  const userIdStr = userId.toString().padStart(16, '0');
  
  for (let i = 0; i < 16; i++) {
    // Простая хеш-функция для превращения цифр userId в байты энтропии
    entropy[i] = parseInt(userIdStr[i]) * 16 + i;
  }
  
  // Генерируем фразу на основе этой энтропии
  return bip39.entropyToMnemonic(entropy);
}

/**
 * Получает криптовалютные адреса для пользователя на основе его ID
 * @param {number} userId ID пользователя
 * @returns {{ mnemonic: string, btcAddress: string, ethAddress: string }} Мнемоническая фраза и адреса
 */
export async function generateAddressesForUser(userId: number): Promise<{ mnemonic: string, btcAddress: string, ethAddress: string }> {
  const mnemonic = generateDeterministicMnemonicFromUserId(userId);
  const { btcAddress, ethAddress } = await getAddressesFromMnemonic(mnemonic);
  
  return { mnemonic, btcAddress, ethAddress };
}
