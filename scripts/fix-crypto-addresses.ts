/**
 * Скрипт для исправления криптоадресов у всех пользователей
 * Обновляет все btcAddress и ethAddress в картах с типом 'crypto' на валидные адреса
 * Использует библиотеки bitcoinjs-lib и ethers.js для генерации правильных адресов
 */

import { ethers } from 'ethers';
import { db } from '../server/db.js';
import { cards } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { validateCryptoAddress, generateValidAddress } from '../server/utils/crypto.js';

/**
 * Обновляет криптоадреса для всех существующих пользователей
 */
async function fixCryptoAddresses() {
  console.log('Исправление невалидных криптоадресов для всех пользователей...');

  try {
    // Получаем все крипто-карты
    const cryptoCards = await db.select().from(cards).where(eq(cards.type, 'crypto'));
    console.log(`Найдено ${cryptoCards.length} крипто-карт для проверки и обновления`);

    let updatedCount = 0;
    let alreadyValidCount = 0;
    let errorCount = 0;

    // Обрабатываем каждую карту
    for (const card of cryptoCards) {
      try {
        // Проверяем текущие адреса на валидность
        const isBtcValid = card.btcAddress ? validateCryptoAddress(card.btcAddress, 'btc') : false;
        const isEthValid = card.ethAddress ? validateCryptoAddress(card.ethAddress, 'eth') : false;

        // Если оба адреса валидны, пропускаем карту
        if (isBtcValid && isEthValid) {
          console.log(`Карта ${card.id} пользователя ${card.userId} уже имеет валидные адреса:`);
          console.log(`BTC: ${card.btcAddress}`);
          console.log(`ETH: ${card.ethAddress}`);
          alreadyValidCount++;
          continue;
        }

        // Генерируем новые криптоадреса с помощью функции из utils/crypto.ts
        const btcAddress = generateValidAddress('btc', card.userId);
        const ethAddress = generateValidAddress('eth', card.userId);

        // Двойная проверка, что новые адреса валидны
        const isNewBtcValid = validateCryptoAddress(btcAddress, 'btc');
        const isNewEthValid = validateCryptoAddress(ethAddress, 'eth');

        if (!isNewBtcValid || !isNewEthValid) {
          console.error(`Сгенерированные адреса не прошли валидацию для карты ${card.id}:`);
          console.error(`BTC (${isNewBtcValid ? 'валидный' : 'невалидный'}): ${btcAddress}`);
          console.error(`ETH (${isNewEthValid ? 'валидный' : 'невалидный'}): ${ethAddress}`);
          errorCount++;
          continue;
        }

        // Обновляем данные в БД
        await db
          .update(cards)
          .set({
            btcAddress: btcAddress,
            ethAddress: ethAddress
          })
          .where(eq(cards.id, card.id));

        console.log(`✅ Обновлены адреса для карты ${card.id} пользователя ${card.userId}:`);
        console.log(`  Старый BTC: ${card.btcAddress} (${isBtcValid ? 'валидный' : 'невалидный'})`);
        console.log(`  Новый BTC: ${btcAddress} ✓`);
        console.log(`  Старый ETH: ${card.ethAddress} (${isEthValid ? 'валидный' : 'невалидный'})`);
        console.log(`  Новый ETH: ${ethAddress} ✓`);
        
        updatedCount++;
      } catch (error) {
        console.error(`Ошибка при обновлении карты ${card.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Результаты исправления криптоадресов:');
    console.log(`✅ Успешно обновлено: ${updatedCount} карт`);
    console.log(`✓ Уже валидных: ${alreadyValidCount} карт`);
    console.log(`❌ Ошибок: ${errorCount}`);
    
    // Проверяем результат на примере первых 5 карт
    const checkCards = await db
      .select({ 
        id: cards.id,
        userId: cards.userId,
        btcAddress: cards.btcAddress,
        ethAddress: cards.ethAddress
      })
      .from(cards)
      .where(eq(cards.type, 'crypto'))
      .limit(5);
      
    console.log("\nПримеры обновленных карт:", JSON.stringify(checkCards, null, 2));
    
  } catch (error) {
    console.error('Ошибка при обновлении криптоадресов:', error);
  }
}

// Запускаем функцию обновления
fixCryptoAddresses()
  .then(() => console.log('Скрипт завершил работу'))
  .catch(console.error);