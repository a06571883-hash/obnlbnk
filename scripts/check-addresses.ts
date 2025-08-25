/**
 * Скрипт для проверки криптоадресов в базе данных
 */

import { db } from '../server/db.js';
import { cards } from "../shared/schema"';
import { eq } from 'drizzle-orm';
import { validateCryptoAddress } from '../server/utils/crypto.js';

async function checkCryptoAddresses() {
  console.log('📊 Проверка криптоадресов в базе данных...');

  try {
    // Получаем все крипто-карты
    const cryptoCards = await db.select().from(cards).where(eq(cards.type, 'crypto'));
    console.log(`📋 Найдено ${cryptoCards.length} крипто-карт для проверки`);

    let validBtcCount = 0;
    let validEthCount = 0;
    let invalidBtcCount = 0;
    let invalidEthCount = 0;

    // Проверяем все карты
    for (const card of cryptoCards) {
      console.log(`\n📝 Карта #${card.id} пользователя ${card.userId}:`);
      
      // Проверяем BTC адрес
      const isBtcValid = card.btcAddress ? validateCryptoAddress(card.btcAddress, 'btc') : false;
      console.log(`- BTC: ${card.btcAddress || 'отсутствует'} (${isBtcValid ? '✅ валидный' : '❌ невалидный'})`);
      
      if (isBtcValid) {
        validBtcCount++;
      } else {
        invalidBtcCount++;
      }
      
      // Проверяем ETH адрес
      const isEthValid = card.ethAddress ? validateCryptoAddress(card.ethAddress, 'eth') : false;
      console.log(`- ETH: ${card.ethAddress || 'отсутствует'} (${isEthValid ? '✅ валидный' : '❌ невалидный'})`);
      
      if (isEthValid) {
        validEthCount++;
      } else {
        invalidEthCount++;
      }
    }

    // Выводим статистику
    console.log('\n📊 Статистика криптоадресов:');
    console.log(`- BTC: ${validBtcCount} валидных, ${invalidBtcCount} невалидных`);
    console.log(`- ETH: ${validEthCount} валидных, ${invalidEthCount} невалидных`);
    
    // Общее состояние
    const allValid = invalidBtcCount === 0 && invalidEthCount === 0;
    if (allValid) {
      console.log('\n✅ Все криптоадреса в базе данных валидны!');
    } else {
      console.log('\n⚠️ В базе данных есть невалидные криптоадреса.');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке криптоадресов:', error);
  }
}

// Запускаем функцию проверки
checkCryptoAddresses()
  .then(() => console.log('\n📝 Проверка завершена'))
  .catch(error => console.error('❌ Ошибка при выполнении скрипта:', error));