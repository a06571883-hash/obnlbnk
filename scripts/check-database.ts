import { db } from '../server/db.js';
import { cards } from "../shared/schema"';
import { eq } from 'drizzle-orm';

/**
 * Проверяет целостность базы данных и выводит основную информацию
 */
async function checkDatabase() {
  console.log('🔍 Проверка базы данных...');
  
  try {
    // Пробуем получить статистику
    const cryptoCards = await db
      .select()
      .from(cards)
      .where(eq(cards.type, 'crypto'));
      
    console.log(`\n📊 Статистика базы данных:`);
    console.log(`✓ Найдено ${cryptoCards.length} крипто-карт`);
    
    // Проверяем адреса
    let validAddresses = 0;
    for (const card of cryptoCards) {
      if (card.btcAddress && card.ethAddress) {
        validAddresses++;
      }
    }
    
    console.log(`✓ Карт с валидными адресами: ${validAddresses}`);
    console.log('\n✅ База данных работает корректно');
    
    return {
      success: true,
      stats: {
        totalCards: cryptoCards.length,
        validAddresses
      }
    };
  } catch (error) {
    console.error('❌ Ошибка при проверке базы данных:', error);
    
    // Рекомендации по исправлению
    console.log('\n🔧 Рекомендации:');
    console.log('1. Создайте резервную копию: npx tsx scripts/backup-app-state.ts');
    console.log('2. Остановите все процессы приложения');
    console.log('3. Восстановите из резервной копии: npx tsx scripts/restore-app-state.ts');
    
    return {
      success: false,
      error
    };
  }
}

// Запускаем проверку
checkDatabase()
  .then(result => {
    if (!result.success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
  });
