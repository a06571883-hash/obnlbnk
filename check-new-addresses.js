/**
 * Скрипт для проверки новых криптоадресов при создании карт
 * Проверяет, что созданные адреса проходят обновленную валидацию
 */

import { db } from './server/db.ts';
import { cards, users } from './shared/schema.ts';
import { eq } from 'drizzle-orm';
import { validateCryptoAddress } from './server/utils/crypto.ts';

async function checkNewUserAddresses() {
  try {
    console.log('🔍 Проверка криптоадресов в базе данных...\n');
    
    // Получаем все криптокарты
    const cryptoCards = await db
      .select()
      .from(cards)
      .where(eq(cards.type, 'crypto'))
      .limit(10);
    
    console.log(`Найдено ${cryptoCards.length} криптокарт для проверки\n`);
    
    // Проверяем адреса для каждой карты
    for (const card of cryptoCards) {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, card.userId))
        .limit(1);
      
      const username = user.length > 0 ? user[0].username : 'Неизвестный';
      
      console.log(`Карта #${card.id} (Пользователь: ${username})`);
      console.log(`Номер карты: ${card.number}`);
      
      // Проверяем BTC адрес
      const btcAddress = card.btcAddress;
      const isBtcValid = btcAddress ? validateCryptoAddress(btcAddress, 'btc') : false;
      console.log(`BTC адрес: ${btcAddress || 'Отсутствует'}`);
      console.log(`BTC валидность: ${isBtcValid ? '✅ Валидный' : '❌ Невалидный'}`);
      console.log(`BTC адрес начинается с '11': ${btcAddress?.startsWith('11') ? 'Да' : 'Нет'}`);
      
      // Проверяем ETH адрес
      const ethAddress = card.ethAddress;
      const isEthValid = ethAddress ? validateCryptoAddress(ethAddress, 'eth') : false;
      console.log(`ETH адрес: ${ethAddress || 'Отсутствует'}`);
      console.log(`ETH валидность: ${isEthValid ? '✅ Валидный' : '❌ Невалидный'}`);
      
      console.log('----------------------------');
    }
    
    console.log('\n✅ Проверка завершена!');
  } catch (error) {
    console.error('❌ Ошибка при проверке адресов:', error);
  }
}

// Запуск проверки
checkNewUserAddresses();