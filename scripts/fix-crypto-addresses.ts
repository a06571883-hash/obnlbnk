/**
 * Скрипт для исправления криптоадресов у всех пользователей
 * Обновляет все btcAddress и ethAddress в картах с типом 'crypto' на валидные адреса
 * Использует библиотеки bitcoinjs-lib и ethers.js для генерации настоящих криптоадресов
 */

import { ethers } from 'ethers';
import { db } from '../server/db.js';
import { cards } from "../shared/schema.js";
import { eq } from 'drizzle-orm';
import { validateCryptoAddress } from '../server/utils/crypto.js';
import * as bitcoin from 'bitcoinjs-lib';

// Динамическая инициализация ECPair для совместимости с Vercel
let ECPair: any = null;

async function initECPair() {
  if (!ECPair) {
    try {
      const ecc = require('tiny-secp256k1');
      const ECPairFactory = require('ecpair');
      ECPair = ECPairFactory.default ? ECPairFactory.default(ecc) : ECPairFactory(ecc);
    } catch (error) {
      console.error('Failed to initialize ECPair:', error);
      throw error;
    }
  }
  return ECPair;
}

// Инициализируем сеть Bitcoin
const network = bitcoin.networks.bitcoin;

/**
 * Создает настоящий Bitcoin-адрес для пользователя
 * Использует bitcoinjs-lib для создания реального адреса
 */
async function generateBitcoinAddress(userId: number): Promise<string> {
  try {
    // Инициализируем ECPair
    const ecpair = await initECPair();
    
    // Создаем пару ключей с использованием ECPair
    const keyPair = ecpair.makeRandom();

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

    console.log(`✅ Генерация BTC-адреса успешна: ${address} для пользователя: ${userId}`);
    return address;
  } catch (error) {
    console.error(`❌ Ошибка генерации BTC-адреса:`, error);
    throw error;
  }
}

/**
 * Создает настоящий Ethereum-адрес для пользователя
 * Использует ethers.js для создания реального адреса
 */
function generateEthereumAddress(userId: number): string {
  try {
    // Создаем случайный ETH кошелек
    const wallet = ethers.Wallet.createRandom();
    console.log(`✅ Генерация ETH-адреса успешна: ${wallet.address} для пользователя: ${userId}`);
    return wallet.address;
  } catch (error) {
    console.error(`❌ Ошибка генерации ETH-адреса:`, error);
    throw error;
  }
}

/**
 * Обновляет криптоадреса для всех существующих пользователей
 */
async function fixCryptoAddresses() {
  console.log('🔄 Исправление криптоадресов для всех пользователей...');
  console.log('Используем bitcoinjs-lib и ethers.js для генерации настоящих криптовалютных адресов');

  try {
    // Получаем все крипто-карты
    const cryptoCards = await db.select().from(cards).where(eq(cards.type, 'crypto'));
    console.log(`📋 Найдено ${cryptoCards.length} крипто-карт для обновления`);

    let updatedCount = 0;
    let errorCount = 0;

    // Обрабатываем каждую карту
    for (const card of cryptoCards) {
      console.log(`\n📝 Обрабатываем карту #${card.id} пользователя ${card.userId}...`);

      try {
        // Генерируем новые криптоадреса
        console.log(`🔑 Генерируем новые адреса...`);
        const btcAddress = await generateBitcoinAddress(card.userId);
        const ethAddress = generateEthereumAddress(card.userId);

        // Проверяем валидность новых адресов
        const isNewBtcValid = validateCryptoAddress(btcAddress, 'btc');
        const isNewEthValid = validateCryptoAddress(ethAddress, 'eth');

        if (!isNewBtcValid || !isNewEthValid) {
          console.error(`❌ Ошибка: сгенерированные адреса не прошли валидацию для карты ${card.id}:`);
          console.error(`- BTC (${isNewBtcValid ? '✅' : '❌'}): ${btcAddress}`);
          console.error(`- ETH (${isNewEthValid ? '✅' : '❌'}): ${ethAddress}`);
          errorCount++;
          continue;
        }

        // Обновляем данные в БД
        console.log(`💾 Сохраняем новые адреса в базу данных...`);
        await db
          .update(cards)
          .set({
            btcAddress: btcAddress,
            ethAddress: ethAddress
          })
          .where(eq(cards.id, card.id));

        console.log(`\n✅ Успешно обновлены адреса для карты #${card.id}:`);
        console.log(`  Старый BTC: ${card.btcAddress || 'отсутствует'}`);
        console.log(`  Новый BTC: ${btcAddress} ✓`);
        console.log(`  Старый ETH: ${card.ethAddress || 'отсутствует'}`);
        console.log(`  Новый ETH: ${ethAddress} ✓`);

        updatedCount++;
      } catch (error) {
        console.error(`❌ Ошибка при обновлении карты ${card.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Результаты исправления криптоадресов:');
    console.log(`✅ Успешно обновлено: ${updatedCount} карт`);
    console.log(`❌ Ошибок: ${errorCount}`);

    // Проверяем результат
    const checkCards = await db
      .select({ 
        id: cards.id,
        userId: cards.userId,
        btcAddress: cards.btcAddress,
        ethAddress: cards.ethAddress
      })
      .from(cards)
      .where(eq(cards.type, 'crypto'));

    console.log("\n🔍 Проверка обновленных карт:");
    checkCards.forEach(card => {
      const isBtcValid = validateCryptoAddress(card.btcAddress || '', 'btc');
      const isEthValid = validateCryptoAddress(card.ethAddress || '', 'eth');

      console.log(`\nКарта #${card.id} пользователя ${card.userId}:`);
      console.log(`- BTC: ${card.btcAddress} (${isBtcValid ? '✅ валидный' : '❌ невалидный'})`);
      console.log(`- ETH: ${card.ethAddress} (${isEthValid ? '✅ валидный' : '❌ невалидный'})`);
    });

  } catch (error) {
    console.error('❌ Ошибка при обновлении криптоадресов:', error);
  }
}

// Запускаем функцию обновления
fixCryptoAddresses()
  .then(() => console.log('\n✅ Скрипт успешно завершил работу'))
  .catch(error => console.error('❌ Ошибка при выполнении скрипта:', error));
