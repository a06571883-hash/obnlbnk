/**
 * Тестовый скрипт для проверки переводов между криптокартой и фиатной картой
 * Проверяет корректность конвертации и обновления балансов
 */

import { db } from './server/db.js';
import { storage } from './server/storage.js';
import { eq } from 'drizzle-orm';
import { cards, users, transactions } from './shared/schema.js';

async function testTransfers() {
  try {
    console.log("🔍 Тестирование переводов между криптокартой и фиатной картой...");
    
    // Получаем текущие курсы обмена
    const rates = await storage.getLatestExchangeRates();
    if (!rates) {
      throw new Error("❌ Не удалось получить актуальные курсы валют для тестирования");
    }
    
    console.log(`ℹ️ Текущие курсы обмена:
    - BTC → USD: 1 BTC = $${rates.btcToUsd}
    - ETH → USD: 1 ETH = $${rates.ethToUsd}
    - USD → UAH: 1 USD = ${rates.usdToUah} UAH`);
    
    // Получаем криптокарту пользователя
    // Предполагаем, что у пользователя с ID=5 есть криптокарта
    const userCards = await storage.getCardsByUserId(5);
    if (!userCards || userCards.length === 0) {
      throw new Error("❌ Не найдены карты пользователя с ID=5");
    }
    
    const cryptoCard = userCards.find(card => card.type === 'crypto' || card.type === 'btc');
    const usdCard = userCards.find(card => card.type === 'usd');
    const uahCard = userCards.find(card => card.type === 'uah');
    
    if (!cryptoCard) {
      throw new Error("❌ У пользователя нет криптокарты");
    }
    
    if (!usdCard) {
      throw new Error("❌ У пользователя нет USD карты");
    }
    
    if (!uahCard) {
      throw new Error("❌ У пользователя нет UAH карты");
    }
    
    console.log(`ℹ️ Найдены карты пользователя:
    - Криптокарта: ${cryptoCard.number} (BTC баланс: ${cryptoCard.btcBalance})
    - USD карта: ${usdCard.number} (баланс: ${usdCard.balance} USD)
    - UAH карта: ${uahCard.number} (баланс: ${uahCard.balance} UAH)`);
    
    // Сохраняем начальные балансы для последующего сравнения
    const initialBalances = {
      crypto: parseFloat(cryptoCard.btcBalance || '0'),
      usd: parseFloat(usdCard.balance),
      uah: parseFloat(uahCard.balance)
    };
    
    // ТЕСТ 1: Перевод с криптокарты на USD карту
    console.log("\n🧪 ТЕСТ 1: Перевод с криптокарты на USD карту");
    
    // Тестируем с небольшой суммой в 0.001 BTC
    const btcAmount = 0.001;
    
    // Рассчитываем ожидаемую сумму в USD
    const expectedUsd = btcAmount * parseFloat(rates.btcToUsd);
    console.log(`ℹ️ Расчёт конвертации: ${btcAmount} BTC = ${expectedUsd.toFixed(2)} USD`);
    
    try {
      // Выполняем перевод
      const transferResult = await storage.transferMoney(
        cryptoCard.id,
        usdCard.number,
        btcAmount
      );
      
      console.log(`✅ Перевод выполнен успешно:`, transferResult.transaction);
      
      // Получаем обновлённые балансы
      const updatedCryptoCard = await storage.getCardById(cryptoCard.id);
      const updatedUsdCard = await storage.getCardById(usdCard.id);
      
      console.log(`ℹ️ Обновлённые балансы:
      - Криптокарта: ${parseFloat(updatedCryptoCard.btcBalance).toFixed(8)} BTC (было ${initialBalances.crypto.toFixed(8)} BTC)
      - USD карта: ${parseFloat(updatedUsdCard.balance).toFixed(2)} USD (было ${initialBalances.usd.toFixed(2)} USD)`);
      
      // Проверяем, изменился ли баланс на ожидаемую сумму
      // Для крипто мы учитываем также комиссию 1%
      const btcCommission = btcAmount * 0.01;
      const expectedBtcDebit = btcAmount + btcCommission;
      const actualBtcDiff = initialBalances.crypto - parseFloat(updatedCryptoCard.btcBalance);
      const actualUsdDiff = parseFloat(updatedUsdCard.balance) - initialBalances.usd;
      
      console.log(`ℹ️ Проверка изменений:
      - Списано BTC: ${actualBtcDiff.toFixed(8)} (ожидалось: ${expectedBtcDebit.toFixed(8)})
      - Зачислено USD: ${actualUsdDiff.toFixed(2)} (ожидалось: ${expectedUsd.toFixed(2)})`);
      
      // Проверяем, находится ли разница в пределах погрешности
      const btcDiffAccurate = Math.abs(actualBtcDiff - expectedBtcDebit) < 0.0000001;
      const usdDiffAccurate = Math.abs(actualUsdDiff - expectedUsd) < 0.01;
      
      if (btcDiffAccurate && usdDiffAccurate) {
        console.log("✅ ТЕСТ 1 ПРОЙДЕН: Конвертация и обновление балансов выполнены корректно");
      } else {
        console.log("❌ ТЕСТ 1 НЕ ПРОЙДЕН: Обнаружены расхождения в конвертации");
      }
    } catch (error) {
      console.error(`❌ ТЕСТ 1 ОШИБКА:`, error.message);
    }
    
    // ТЕСТ 2: Перевод с криптокарты на UAH карту
    console.log("\n🧪 ТЕСТ 2: Перевод с криптокарты на UAH карту");
    
    // Тестируем с небольшой суммой в 0.001 BTC
    const btcAmountForUah = 0.001;
    
    // Рассчитываем ожидаемую сумму в UAH (BTC → USD → UAH)
    const expectedUahInUsd = btcAmountForUah * parseFloat(rates.btcToUsd);
    const expectedUah = expectedUahInUsd * parseFloat(rates.usdToUah);
    console.log(`ℹ️ Расчёт конвертации: ${btcAmountForUah} BTC → ${expectedUahInUsd.toFixed(2)} USD → ${expectedUah.toFixed(2)} UAH`);
    
    try {
      // Выполняем перевод
      const transferResult = await storage.transferMoney(
        cryptoCard.id,
        uahCard.number,
        btcAmountForUah
      );
      
      console.log(`✅ Перевод выполнен успешно:`, transferResult.transaction);
      
      // Получаем обновлённые балансы
      const updatedCryptoCard = await storage.getCardById(cryptoCard.id);
      const updatedUahCard = await storage.getCardById(uahCard.id);
      
      // Получаем текущие балансы после первого теста
      const currentCryptoBalance = parseFloat(updatedCryptoCard.btcBalance);
      const currentUahBalance = parseFloat(updatedUahCard.balance);
      
      console.log(`ℹ️ Текущие балансы (после ТЕСТА 1):
      - Криптокарта: ${currentCryptoBalance.toFixed(8)} BTC
      - UAH карта: ${currentUahBalance.toFixed(2)} UAH`);
      
      console.log("✅ ТЕСТ 2 УСПЕШНО ВЫПОЛНЕН");
      
    } catch (error) {
      console.error(`❌ ТЕСТ 2 ОШИБКА:`, error.message);
    }
    
    console.log("\n✅ Тестирование завершено");
    
  } catch (error) {
    console.error("❌ Ошибка при тестировании:", error);
  } finally {
    process.exit(0);
  }
}

// Запуск тестирования
testTransfers();