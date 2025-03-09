/**
 * Скрипт для обновления криптоадресов у всех существующих пользователей
 * Обновляет все btcAddress и ethAddress в картах с типом 'crypto' на валидные адреса
 */

import { pool, db } from '../server/db';
import { initializeDatabase } from '../server/db';
import { cards } from '../shared/schema';
import { eq, and, isNull, ne } from 'drizzle-orm';
import { generateValidAddress } from '../server/utils/crypto';
import { ethers } from 'ethers';

async function updateCryptoAddresses() {
  console.log('Начинаем обновление криптоадресов для всех пользователей...');

  try {
    // Получаем все крипто-карты из базы данных
    const cryptoCards = await db.query.cards.findMany({
      where: eq(cards.type, 'crypto')
    });

    console.log(`Найдено ${cryptoCards.length} крипто-карт для обновления`);

    let updatedCount = 0;
    let errorCount = 0;

    // Обрабатываем каждую карту
    for (const card of cryptoCards) {
      try {
        // Генерируем новые криптоадреса
        const btcAddress = generateValidAddress('btc', card.userId);
        const ethAddress = generateValidAddress('eth', card.userId);

        // Обновляем данные в БД
        await db.update(cards)
          .set({
            btcAddress,
            ethAddress
          })
          .where(eq(cards.id, card.id));

        console.log(`Обновлены адреса для карты ${card.id} пользователя ${card.userId}:`);
        console.log(`BTC: ${btcAddress}`);
        console.log(`ETH: ${ethAddress}`);
        
        updatedCount++;
      } catch (error) {
        console.error(`Ошибка при обновлении карты ${card.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Обновление завершено!`);
    console.log(`Успешно обновлено: ${updatedCount} карт`);
    console.log(`Ошибок: ${errorCount}`);

  } catch (error) {
    console.error('Ошибка при обновлении криптоадресов:', error);
  } finally {
    process.exit(0);
  }
}

// Запускаем обновление
updateCryptoAddresses();