import fs from 'fs';
import path from 'path';
import { db } from '../server/db.js';
import { cards } from "../shared/schema"';
import JSZip from 'jszip';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'url';

/**
 * Восстанавливает состояние приложения из резервной копии
 * @param backupPath Путь к файлу резервной копии
 */
async function restoreAppState(backupPath?: string) {
  console.log('🔄 Начинаем восстановление приложения из резервной копии...');

  try {
    // Если путь не указан, ищем самый свежий бэкап
    if (!backupPath) {
      const backupDir = path.join(process.cwd(), 'backup');
      if (!fs.existsSync(backupDir)) {
        throw new Error('Директория с резервными копиями не найдена');
      }

      const backups = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('backup-') && file.endsWith('.zip'))
        .sort()
        .reverse();

      if (backups.length === 0) {
        throw new Error('Резервные копии не найдены');
      }

      backupPath = path.join(backupDir, backups[0]);
    }

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Файл резервной копии не найден: ${backupPath}`);
    }

    console.log(`📦 Распаковываем резервную копию: ${backupPath}`);
    const zipContent = fs.readFileSync(backupPath);
    const zip = await JSZip.loadAsync(zipContent);

    // 1. Восстанавливаем файлы с кодом
    console.log('\n📁 Восстанавливаем файлы с кодом...');
    for (const [filename, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const content = await file.async('string');
        const targetPath = path.join(process.cwd(), filename);

        // Создаем директории если их нет
        const dirname = path.dirname(targetPath);
        if (!fs.existsSync(dirname)) {
          fs.mkdirSync(dirname, { recursive: true });
        }

        // Сохраняем оригинальный файл как .bak если он существует
        if (fs.existsSync(targetPath)) {
          fs.copyFileSync(targetPath, `${targetPath}.bak`);
        }

        fs.writeFileSync(targetPath, content);
        console.log(`✅ Восстановлен файл: ${filename}`);
      }
    }

    // 2. Восстанавливаем данные базы
    console.log('\n💾 Восстанавливаем данные базы данных...');
    const dbBackupFile = zip.file('database/crypto_cards.json');
    if (dbBackupFile) {
      const dbBackupContent = await dbBackupFile.async('string');
      const dbBackup = JSON.parse(dbBackupContent);

      // Проверяем версию бэкапа
      if (dbBackup.version !== '1.0.0') {
        console.warn('⚠️ Версия бэкапа отличается от текущей версии приложения');
      }

      // Восстанавливаем крипто-карты
      for (const card of dbBackup.cards) {
        await db
          .insert(cards)
          .values(card)
          .onConflictDoUpdate({
            target: cards.id,
            set: {
              btcAddress: card.btcAddress,
              ethAddress: card.ethAddress
            }
          });
      }

      console.log(`✅ Восстановлено ${dbBackup.cards.length} крипто-карт`);
    }

    // 3. Восстанавливаем конфигурацию
    console.log('\n⚙️ Восстанавливаем конфигурацию...');
    const envFile = zip.file('.env.backup');
    if (envFile) {
      const envContent = await envFile.async('string');
      fs.writeFileSync('.env', envContent);
      console.log('✅ Восстановлен файл .env');
    }

    console.log('\n✅ Восстановление успешно завершено!');
    console.log('🔍 Проверьте работу приложения и валидность крипто-адресов');

    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка при восстановлении:', error);
    throw error;
  }
}

// Запускаем скрипт восстановления если он вызван напрямую
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  const backupPath = process.argv[2]; // Можно указать конкретный файл бэкапа
  restoreAppState(backupPath)
    .then(() => console.log('\n🎉 Восстановление завершено успешно!'))
    .catch(error => console.error('\n❌ Ошибка при восстановлении:', error));
}

export { restoreAppState };