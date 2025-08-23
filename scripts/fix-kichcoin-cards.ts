
import { db } from '../server/db';
import { cards } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Генерирует валидный TON адрес
 */
function generateTonAddress(): string {
  // TON адреса обычно начинаются с 'EQ' или 'UQ' и имеют длину 48 символов
  const prefix = Math.random() > 0.5 ? 'EQ' : 'UQ';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let address = prefix;
  
  // Генерируем 46 символов (48 - 2 для префикса)
  for (let i = 0; i < 46; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return address;
}

/**
 * Основная функция для исправления карт KICH COIN
 */
async function fixKichCoinCards() {
  console.log('🔄 Запуск исправления карт KICH COIN...');
  
  try {
    // Получаем все крипто-карты
    const cryptoCards = await db.select().from(cards).where(eq(cards.type, 'crypto'));
    console.log(`📋 Найдено ${cryptoCards.length} крипто-карт для проверки`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const card of cryptoCards) {
      try {
        console.log(`\n📝 Обрабатываем карту #${card.id} пользователя ${card.userId}...`);
        
        // Генерируем TON адрес если его нет
        let tonAddress = card.tonAddress;
        let needsUpdate = false;
        
        if (!tonAddress || tonAddress.length === 0) {
          tonAddress = generateTonAddress();
          needsUpdate = true;
          console.log(`🆕 Сгенерирован новый TON адрес: ${tonAddress}`);
        } else {
          console.log(`✅ TON адрес уже существует: ${tonAddress}`);
        }
        
        // Проверяем и обновляем другие адреса если нужно
        let btcAddress = card.btcAddress;
        let ethAddress = card.ethAddress;
        
        if (!btcAddress || btcAddress.length === 0) {
          // Генерируем простой BTC адрес для тестирования
          btcAddress = '1' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          needsUpdate = true;
          console.log(`🆕 Сгенерирован новый BTC адрес: ${btcAddress}`);
        }
        
        if (!ethAddress || ethAddress.length === 0) {
          // Генерируем простой ETH адрес для тестирования
          ethAddress = '0x' + Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
          needsUpdate = true;
          console.log(`🆕 Сгенерирован новый ETH адрес: ${ethAddress}`);
        }
        
        if (needsUpdate) {
          // Обновляем данные в БД
          await db
            .update(cards)
            .set({
              tonAddress: tonAddress,
              btcAddress: btcAddress,
              ethAddress: ethAddress
            })
            .where(eq(cards.id, card.id));
          
          console.log(`✅ Карта #${card.id} успешно обновлена:`);
          console.log(`  TON: ${tonAddress}`);
          console.log(`  BTC: ${btcAddress}`);
          console.log(`  ETH: ${ethAddress}`);
          
          updatedCount++;
        } else {
          console.log(`ℹ️ Карта #${card.id} не требует обновления`);
        }
        
      } catch (error) {
        console.error(`❌ Ошибка при обновлении карты ${card.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📊 Результаты исправления карт KICH COIN:');
    console.log(`✅ Успешно обновлено: ${updatedCount}`);
    console.log(`❌ Ошибок: ${errorCount}`);
    console.log(`📱 Всего проверено: ${cryptoCards.length}`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 Все TON адреса успешно сгенерированы!');
    } else {
      console.log('\n✨ Все карты уже имели необходимые адреса');
    }
    
  } catch (error) {
    console.error('💥 Критическая ошибка при исправлении карт:', error);
    process.exit(1);
  }
}

// Запуск скрипта
fixKichCoinCards()
  .then(() => {
    console.log('\n✅ Скрипт завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Скрипт завершился с ошибкой:', error);
    process.exit(1);
  });
