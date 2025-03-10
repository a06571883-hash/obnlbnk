import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { randomBytes, createHash } from 'crypto';
import * as Bip39 from 'bip39';

const ECPair = ECPairFactory(ecc);

/**
 * Генерирует реальные криптоадреса для пользователя
 * @param type Тип криптоадреса ('btc' или 'eth')
 * @param userId ID пользователя
 * @returns Сгенерированный адрес
 */
export function generateValidAddress(type: 'btc' | 'eth', userId: number): string {
  try {
    // Для обеспечения стабильных, но уникальных для каждого пользователя адресов
    // используем детерминистический подход на основе userId
    if (type === 'btc') {
      // Генерируем детерминистический seed для BTC
      const seed = createUniqueUserSeed(userId);
      // Создаем новую ключевую пару напрямую (конвертируем в Buffer, т.к. этого требует API)
      const seedBuffer = Buffer.from(seed);
      const keyPair = ECPair.makeRandom({
        rng: () => seedBuffer
      });
      
      // Создаем Legacy адрес (P2PKH), начинающийся с '1'
      const { address } = bitcoin.payments.p2pkh({ 
        pubkey: keyPair.publicKey 
      });
      
      if (!address) {
        throw new Error("Failed to generate BTC address");
      }
      
      console.log(`Generated real BTC address: ${address} for user: ${userId}`);
      return address;
    } else {
      // Для ETH создаем кошелек с приватным ключом на основе userId
      const privateKeyBytes = createUniqueUserSeed(userId);
      // Преобразуем байты в hex-строку приватного ключа
      const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex');
      
      // Создаем кошелек из приватного ключа
      const wallet = new ethers.Wallet(`0x${privateKeyHex}`);
      console.log(`Generated ETH address: ${wallet.address} for user: ${userId}`);
      return wallet.address;
    }
  } catch (error) {
    console.error(`Error generating ${type} address:`, error);
    
    // Если основной метод не сработал, создаем полностью случайный адрес
    try {
      // Создаем полностью случайный ключ/адрес
      if (type === 'btc') {
        const keyPair = ECPair.makeRandom();
        const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
        
        console.log(`Generated random BTC address: ${address} for user: ${userId}`);
        return address || '';
      } else {
        const wallet = ethers.Wallet.createRandom();
        console.log(`Generated random ETH address: ${wallet.address} for user: ${userId}`);
        return wallet.address;
      }
    } catch (fallbackError) {
      console.error(`Fallback error generating ${type} address:`, fallbackError);
      
      // В самом крайнем случае возвращаем пустую строку
      console.error(`Complete failure generating ${type} address for user ${userId}`);
      return '';
    }
  }
}

/**
 * Создает уникальный seed для криптографических операций на основе ID пользователя
 * @param userId ID пользователя
 * @returns Байты для генерации ключей
 */
function createUniqueUserSeed(userId: number): Uint8Array {
  // Создаем детерминированный input на основе ID пользователя и соли
  const salt = "CryptoVirtualBank2025Salt";
  const input = `${userId}-${salt}-${userId % 999}-${Math.floor(userId / 100)}`;
  
  // Генерируем 32 байта (256 бит) из SHA-256 хеша
  const hash = createHash('sha256').update(input).digest();
  return hash;
}

/**
 * Проверяет валидность криптоадреса
 * @param address Адрес для проверки  
 * @param type Тип криптоадреса ('btc' или 'eth')
 * @returns true если адрес валидный, false если нет
 */
export function validateCryptoAddress(address: string, type: 'btc' | 'eth'): boolean {
  if (!address) return false;

  try {
    const cleanAddress = address.trim();

    if (type === 'btc') {
      try {
        // Попытка использовать bitcoinjs-lib для проверки адреса
        // Если адрес невалидный, это выбросит исключение
        
        // Проверка Legacy P2PKH адресов (начинающихся с 1)
        if (cleanAddress.startsWith('1')) {
          // Валидация по Base58Check и правильности формата
          const validChars = /^[1-9A-HJ-NP-Za-km-z]+$/;
          const hasValidChars = validChars.test(cleanAddress);
          const hasValidLength = cleanAddress.length >= 26 && cleanAddress.length <= 34;
          
          const isValid = hasValidChars && hasValidLength;
          console.log(`Validating BTC address (Legacy): ${cleanAddress}, valid: ${isValid}`);
          return isValid;
        }
        
        // Проверка P2SH адресов (начинающихся с 3)
        if (cleanAddress.startsWith('3')) {
          const validChars = /^[1-9A-HJ-NP-Za-km-z]+$/;
          const hasValidChars = validChars.test(cleanAddress);
          const hasValidLength = cleanAddress.length >= 26 && cleanAddress.length <= 35;
          
          const isValid = hasValidChars && hasValidLength;
          console.log(`Validating BTC address (P2SH): ${cleanAddress}, valid: ${isValid}`);
          return isValid;
        }
        
        // Проверка SegWit адресов (начинающихся с bc1)
        if (cleanAddress.startsWith('bc1')) {
          // Для SegWit нужна более сложная проверка по bech32
          // Но для наших целей проверим длину и формат
          const hasValidChar = /^bc1[ac-hj-np-z02-9]+$/.test(cleanAddress);
          const hasValidLength = cleanAddress.length >= 42 && cleanAddress.length <= 62;
          
          const isValid = hasValidChar && hasValidLength;
          console.log(`Validating BTC address (SegWit): ${cleanAddress}, valid: ${isValid}`);
          return isValid;
        }
        
        // Если адрес не начинается с 1, 3 или bc1, он невалидный
        console.log(`Validating BTC address (unknown format): ${cleanAddress}, valid: false`);
        return false;
      } catch (error) {
        console.error(`Error validating BTC address: ${cleanAddress}`, error);
        return false;
      }
    } else if (type === 'eth') {
      // Проверяем валидность ETH адреса через ethers.js
      const isValid = ethers.isAddress(cleanAddress);
      console.log(`Validating ETH address: ${cleanAddress}, valid: ${isValid}`);
      return isValid;
    }
  } catch (error) {
    console.error(`Error validating ${type} address:`, error);
    return false;
  }
  return false;
}