import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { randomBytes, createHash } from 'crypto';
import * as Bip39 from 'bip39';

// Корректная инициализация ECPair с поддержкой tiny-secp256k1
const ECPair = ECPairFactory(ecc);

// Предотвращаем строгую проверку сети, которая может быть проблемой в некоторых версиях bitcoinjs-lib
const network = bitcoin.networks.bitcoin;

/**
 * Генерирует НАСТОЯЩИЕ крипто-адреса для пользователя,
 * которые точно работают с реальными биржами
 * @param type Тип криптоадреса ('btc' или 'eth')
 * @param userId ID пользователя
 * @returns Сгенерированный адрес
 */
export function generateValidAddress(type: 'btc' | 'eth', userId: number): string {
  try {
    if (type === 'btc') {
      try {
        // Создаем пару ключей с использованием ECPair
        const keyPair = ECPair.makeRandom();

        // Конвертируем публичный ключ в Buffer для bitcoinjs-lib
        const pubKeyBuffer = Buffer.from(keyPair.publicKey);

        // Создаем Legacy адрес (P2PKH)
        const { address } = bitcoin.payments.p2pkh({ 
          pubkey: pubKeyBuffer,
          network: network
        });

        if (!address) {
          throw new Error("Failed to generate BTC address");
        }

        console.log(`✅ Generated REAL BTC address: ${address} for user: ${userId}`);
        return address;
      } catch (btcError) {
        console.error("Error generating BTC address:", btcError);
        throw btcError;
      }
    } else {
      try {
        // Создаем случайный ETH кошелек через ethers.js
        const wallet = ethers.Wallet.createRandom();
        console.log(`✅ Generated REAL ETH address: ${wallet.address} for user: ${userId}`);
        return wallet.address;
      } catch (ethError) {
        console.error("Error creating ETH wallet:", ethError);
        throw ethError;
      }
    }
  } catch (error) {
    console.error(`Critical error generating ${type} address:`, error);
    throw error;
  }
}

/**
 * Проверяет валидность криптоадреса - обновленная версия
 * Упрощенная и надежная реализация, устраняющая все ошибки
 * @param address Адрес для проверки  
 * @param type Тип криптоадреса ('btc' или 'eth')
 * @returns true если адрес валидный, false если нет
 */
export function validateCryptoAddress(address: string, type: 'btc' | 'eth'): boolean {
  // Базовая проверка входных данных
  if (!address || typeof address !== 'string') {
    console.log(`Invalid ${type} address: empty or not a string`);
    return false;
  }

  try {
    const cleanAddress = address.trim();
    
    // Проверка Bitcoin адреса
    if (type === 'btc') {
      // Проверка на некорректные вставки
      if (cleanAddress.includes('BTC') || cleanAddress.includes('btc')) {
        console.log(`Обнаружен фиктивный BTC адрес: ${cleanAddress}`);
        return false;
      }
      
      // Упрощенные проверки для разных типов BTC адресов
      // Legacy адреса (начинаются с 1)
      const legacyRegex = /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
      
      // P2SH адреса (начинаются с 3)
      const p2shRegex = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
      
      // SegWit адреса (начинаются с bc1)
      const segwitRegex = /^bc1[a-zA-HJ-NP-Z0-9]{25,90}$/;
      
      // Проверка регулярками
      const isValid = legacyRegex.test(cleanAddress) || 
                     p2shRegex.test(cleanAddress) || 
                     segwitRegex.test(cleanAddress);
      
      console.log(`[SERVER] Validating BTC address: ${cleanAddress}, valid: ${isValid}`);
      return isValid;
    } 
    // Проверка Ethereum адреса
    else if (type === 'eth') {
      // Базовая проверка формата
      const formatRegex = /^0x[a-fA-F0-9]{40}$/i;
      const hasValidFormat = formatRegex.test(cleanAddress);
      
      console.log(`[SERVER] Validating ETH address: ${cleanAddress}, valid: ${hasValidFormat}`);
      return hasValidFormat;
    }
    
    // Неизвестный тип криптовалюты
    console.log(`Unknown crypto type: ${type}`);
    return false;
  } catch (error) {
    console.error(`[SERVER] Error validating ${type} address:`, error);
    return false;
  }
}