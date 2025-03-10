/**
 * Скрипт для исправления криптоадресов у всех пользователей
 * Обновляет все btcAddress и ethAddress в картах с типом 'crypto' на валидные адреса
 * Использует библиотеки bitcoinjs-lib и ethers.js для генерации настоящих криптоадресов
 */

import { ethers } from 'ethers';
import { db } from '../server/db.js';
import { cards } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { validateCryptoAddress, generateValidAddress } from '../server/utils/crypto.js';
import * as bitcoin from 'bitcoinjs-lib';
import { randomBytes } from 'crypto';

/**
 * Обновляет криптоадреса для всех существующих пользователей
 */
async function fixCryptoAddresses() {
  console.log('🔄 Исправление невалидных криптоадресов для всех пользователей...');
  console.log('Используем BIP39, HD-кошельки и криптографические библиотеки для генерации валидных адресов');

  try {
    // Получаем все крипто-карты
    const cryptoCards = await db.select().from(cards).where(eq(cards.type, 'crypto'));
    console.log(`📋 Найдено ${cryptoCards.length} крипто-карт для проверки и обновления`);

    let updatedCount = 0;
    let alreadyValidCount = 0;
    let errorCount = 0;

    // Обрабатываем каждую карту
    for (const card of cryptoCards) {
      console.log(`\n📝 Обрабатываем карту #${card.id} пользователя ${card.userId}...`);
      
      try {
        // Проверяем текущие адреса на валидность
        const isBtcValid = card.btcAddress ? validateCryptoAddress(card.btcAddress, 'btc') : false;
        const isEthValid = card.ethAddress ? validateCryptoAddress(card.ethAddress, 'eth') : false;

        console.log(`Текущие адреса:`);
        console.log(`- BTC: ${card.btcAddress || 'отсутствует'} (${isBtcValid ? '✅ валидный' : '❌ невалидный'})`);
        console.log(`- ETH: ${card.ethAddress || 'отсутствует'} (${isEthValid ? '✅ валидный' : '❌ невалидный'})`);

        // Если оба адреса валидны, пропускаем карту
        if (isBtcValid && isEthValid) {
          console.log(`✅ Карта #${card.id} уже имеет валидные адреса, пропускаем`);
          alreadyValidCount++;
          continue;
        }

        // Генерируем новые криптоадреса с помощью улучшенной функции из utils/crypto.ts
        console.log(`🔑 Генерируем новые адреса...`);
        const btcAddress = generateValidAddress('btc', card.userId);
        const ethAddress = generateValidAddress('eth', card.userId);

        // Двойная проверка, что новые адреса валидны
        const isNewBtcValid = validateCryptoAddress(btcAddress, 'btc');
        const isNewEthValid = validateCryptoAddress(ethAddress, 'eth');

        if (!isNewBtcValid || !isNewEthValid) {
          console.error(`❌ Ошибка: сгенерированные адреса не прошли валидацию для карты ${card.id}:`);
          console.error(`- BTC (${isNewBtcValid ? '✅ валидный' : '❌ невалидный'}): ${btcAddress}`);
          console.error(`- ETH (${isNewEthValid ? '✅ валидный' : '❌ невалидный'}): ${ethAddress}`);
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
    console.log(`✓ Уже валидных: ${alreadyValidCount} карт`);
    console.log(`❌ Ошибок: ${errorCount}`);
    
    // Проверяем результат на примере всех карт
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