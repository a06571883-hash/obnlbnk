import fs from 'fs';
import path from 'path';
import { db } from '../server/db.js';
import { cards } from "../shared/schema"';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';

/**
 * Создает полную резервную копию приложения
 * Сохраняет:
 * 1. Все файлы с кодом
 * 2. Данные из базы данных
 * 3. Конфигурационные файлы
 */
async function backupAppState() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backup', timestamp);
  const zip = new JSZip();

  console.log('🔄 Начинаем создание резервной копии приложения...');

  try {
    // Создаем директорию для бэкапа если её нет
    if (!fs.existsSync(path.join(process.cwd(), 'backup'))) {
      fs.mkdirSync(path.join(process.cwd(), 'backup'));
    }

    // 1. Сохраняем важные файлы кода
    console.log('📁 Сохраняем файлы с кодом...');
    const filesToBackup = [
      'server/utils/crypto.ts',
      'scripts/fix-crypto-addresses.ts',
      'scripts/simplify-crypto-addresses.ts',
      'shared/schema.ts',
      'server/db.ts',
      'server/routes.ts',
      'server/storage.ts',
      'drizzle.config.ts',
      'package.json'
    ];

    for (const filePath of filesToBackup) {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        zip.file(filePath, fileContent);
        console.log(`✅ Сохранен файл: ${filePath}`);
      } else {
        console.warn(`⚠️ Файл не найден: ${filePath}`);
      }
    }

    // 2. Сохраняем данные из базы
    console.log('\n💾 Сохраняем данные из базы данных...');

    // Получаем все крипто-карты
    const cryptoCards = await db
      .select()
      .from(cards)
      .where(eq(cards.type, 'crypto'))
      .execute();

    // Сохраняем данные карт в JSON
    const dbBackup = {
      timestamp: new Date().toISOString(),
      cards: cryptoCards,
      version: '1.0.0',
      meta: {
        total_cards: cryptoCards.length,
        backup_type: 'full'
      }
    };

    zip.file('database/crypto_cards.json', JSON.stringify(dbBackup, null, 2));
    console.log(`✅ Сохранено ${cryptoCards.length} крипто-карт`);

    // 3. Сохраняем конфигурационные файлы
    console.log('\n⚙️ Сохраняем конфигурационные файлы...');
    if (fs.existsSync('.env')) {
      zip.file('.env.backup', fs.readFileSync('.env', 'utf-8'));
      console.log('✅ Сохранен файл .env');
    }

    // Создаем архив
    console.log('\n📦 Создаем архив бэкапа...');
    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
    const backupPath = path.join(process.cwd(), 'backup', `backup-${timestamp}.zip`);
    fs.writeFileSync(backupPath, zipContent);

    console.log('\n✅ Резервная копия успешно создана!');
    console.log(`📍 Путь к бэкапу: ${backupPath}`);
    console.log('\nДля восстановления используйте скрипт restore-app-state.ts');

    return {
      success: true,
      backupPath,
      timestamp,
      stats: {
        cards: cryptoCards.length,
        files: filesToBackup.length
      }
    };
  } catch (error) {
    console.error('❌ Ошибка при создании резервной копии:', error);
    throw error;
  }
}

// Запускаем создание резервной копии
backupAppState()
  .then(result => {
    if (result.success) {
      console.log('\n📊 Статистика бэкапа:');
      console.log(`- Сохранено карт: ${result.stats.cards}`);
      console.log(`- Сохранено файлов: ${result.stats.files}`);
      console.log(`- Временная метка: ${result.timestamp}`);
    }
  })
  .catch(error => console.error('❌ Критическая ошибка:', error));