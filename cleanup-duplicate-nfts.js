/**
 * Скрипт для полной очистки дубликатов NFT
 * и устранения проблем с множественными звуковыми эффектами
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Подключение к базе данных PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

/**
 * Удаляет все дубликаты NFT с одинаковыми token_id
 */
async function removeDuplicateNFTs() {
  try {
    console.log('Поиск и удаление дубликатов NFT...');
    
    // Находим все token_id, которые встречаются более одного раза
    const findDuplicatesQuery = `
      SELECT token_id, COUNT(*) as count
      FROM nfts
      GROUP BY token_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    const duplicatesResult = await client.query(findDuplicatesQuery);
    
    if (duplicatesResult.rows.length === 0) {
      console.log('Дубликаты NFT не найдены.');
      return 0;
    }
    
    console.log(`Найдено ${duplicatesResult.rows.length} NFT с дубликатами:`);
    duplicatesResult.rows.slice(0, 10).forEach(dup => {
      console.log(`- Token ID ${dup.token_id}: ${dup.count} дубликатов`);
    });
    
    // Для каждого дублирующегося token_id оставляем только одну запись
    let totalRemoved = 0;
    
    for (const duplicate of duplicatesResult.rows) {
      const { token_id, count } = duplicate;
      
      // Находим конкретные записи для данного token_id
      const findItemsQuery = `
        SELECT id, token_id, name
        FROM nfts
        WHERE token_id = $1
        ORDER BY id DESC
      `;
      
      const itemsResult = await client.query(findItemsQuery, [token_id]);
      const items = itemsResult.rows;
      
      // Оставляем самую новую запись (с наибольшим id)
      const keepItem = items[0];
      const removeItems = items.slice(1);
      
      console.log(`Token ID ${token_id}: оставляем NFT с ID ${keepItem.id} (${keepItem.name}), удаляем ${removeItems.length} дубликатов`);
      
      // Удаляем дубликаты с предварительным удалением связанных записей
      if (removeItems.length > 0) {
        for (const item of removeItems) {
          try {
            // Сначала удаляем связанные записи из nft_transfers
            const deleteTransfersQuery = `
              DELETE FROM nft_transfers
              WHERE nft_id = $1
            `;
            
            await client.query(deleteTransfersQuery, [item.id]);
            
            // После удаления связанных записей, удаляем сам NFT
            const deleteNftQuery = `
              DELETE FROM nfts
              WHERE id = $1
            `;
            
            const deleteResult = await client.query(deleteNftQuery, [item.id]);
            if (deleteResult.rowCount > 0) {
              totalRemoved++;
            }
          } catch (err) {
            console.error(`Ошибка при удалении NFT с ID ${item.id}:`, err.message);
          }
        }
      }
    }
    
    console.log(`Всего удалено ${totalRemoved} дубликатов NFT`);
    return totalRemoved;
  } catch (error) {
    console.error('Ошибка при удалении дубликатов NFT:', error);
    return 0;
  }
}

/**
 * Проверяет соответствие коллекций и наименований
 */
async function checkCollectionsConsistency() {
  try {
    console.log('Проверка согласованности коллекций...');
    
    // Подсчет NFT по коллекциям
    const countByCollectionQuery = `
      SELECT c.id, c.name, COUNT(*) as count
      FROM nfts n
      JOIN nft_collections c ON n.collection_id = c.id
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `;
    
    const collectionResult = await client.query(countByCollectionQuery);
    
    console.log('Распределение NFT по коллекциям:');
    collectionResult.rows.forEach(coll => {
      console.log(`- ${coll.name} (ID ${coll.id}): ${coll.count} NFT`);
    });
    
    // Проверка наличия BAYC и MAYC коллекций
    let baycId = null;
    let maycId = null;
    
    for (const coll of collectionResult.rows) {
      if (coll.name.includes('Bored Ape') && !coll.name.includes('Mutant')) {
        baycId = coll.id;
      } else if (coll.name.includes('Mutant Ape')) {
        maycId = coll.id;
      }
    }
    
    console.log(`ID коллекции BAYC: ${baycId || 'не найдена'}`);
    console.log(`ID коллекции MAYC: ${maycId || 'не найдена'}`);
    
    return { baycId, maycId };
  } catch (error) {
    console.error('Ошибка при проверке коллекций:', error);
    return { baycId: null, maycId: null };
  }
}

/**
 * Исправляет проблемы с путями к изображениям
 */
async function fixImagePaths(baycId, maycId) {
  try {
    if (!baycId || !maycId) {
      console.log('Не удалось найти ID коллекций BAYC и MAYC, пропускаем исправление путей.');
      return 0;
    }
    
    console.log('Исправление путей к изображениям NFT...');
    
    // Проверяем структуру таблицы nfts
    const tableInfoQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'nfts'
    `;
    
    const tableInfo = await client.query(tableInfoQuery);
    const columns = tableInfo.rows.map(row => row.column_name);
    
    console.log('Доступные колонки в таблице nfts:', columns.join(', '));
    
    // Определяем имя колонки, содержащей URL изображения
    let imageColumn = null;
    if (columns.includes('image_url')) {
      imageColumn = 'image_url';
    } else if (columns.includes('image_path')) {
      imageColumn = 'image_path';
    } else if (columns.includes('image')) {
      imageColumn = 'image';
    }
    
    if (!imageColumn) {
      console.log('Не удалось найти колонку с путями к изображениям в таблице nfts');
      return 0;
    }
    
    console.log(`Используем колонку ${imageColumn} для путей к изображениям`);
    
    // Исправляем пути для BAYC (должны содержать bored_ape или bayc)
    const fixBAYCQuery = `
      UPDATE nfts
      SET ${imageColumn} = CASE
        WHEN ${imageColumn} LIKE '%/mutant_ape%' THEN REPLACE(${imageColumn}, '/mutant_ape', '/bored_ape')
        ELSE ${imageColumn}
      END
      WHERE collection_id = $1
        AND ${imageColumn} LIKE '%/mutant_ape%'
    `;
    
    const baycResult = await client.query(fixBAYCQuery, [baycId]);
    console.log(`Исправлено ${baycResult.rowCount} путей для BAYC NFT`);
    
    // Исправляем пути для MAYC (должны содержать mutant_ape)
    const fixMAYCQuery = `
      UPDATE nfts
      SET ${imageColumn} = CASE
        WHEN ${imageColumn} LIKE '%/bored_ape%' OR ${imageColumn} LIKE '%/bayc%' 
        THEN REPLACE(REPLACE(${imageColumn}, '/bored_ape', '/mutant_ape'), '/bayc', '/mutant_ape')
        ELSE ${imageColumn}
      END
      WHERE collection_id = $1
        AND (${imageColumn} LIKE '%/bored_ape%' OR ${imageColumn} LIKE '%/bayc%')
    `;
    
    const maycResult = await client.query(fixMAYCQuery, [maycId]);
    console.log(`Исправлено ${maycResult.rowCount} путей для MAYC NFT`);
    
    return baycResult.rowCount + maycResult.rowCount;
  } catch (error) {
    console.error('Ошибка при исправлении путей к изображениям:', error);
    return 0;
  }
}

/**
 * Исправляет проблемы со звуками в приложении
 */
async function fixSoundIssues() {
  try {
    console.log('Проверка файлов звуков...');
    
    const publicDir = path.join(__dirname, 'public');
    const soundsDir = path.join(publicDir, 'sounds');
    
    // Проверяем существование директории
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
      console.log(`Создана директория для звуков: ${soundsDir}`);
    }
    
    // Проверяем файл silent.mp3
    const silentFile = path.join(soundsDir, 'silent.mp3');
    if (!fs.existsSync(silentFile)) {
      // Создаем пустой MP3 файл для silent.mp3
      fs.writeFileSync(silentFile, Buffer.from('ID3', 'utf8'));
      console.log(`Создан пустой файл: ${silentFile}`);
    }
    
    // Проверяем дублирование аудио файлов
    const audioDir = path.join(publicDir, 'audio');
    if (fs.existsSync(audioDir)) {
      // Проверяем и удаляем ненужные аудиофайлы
      const files = fs.readdirSync(audioDir);
      console.log(`Найдено ${files.length} файлов в директории audio`);
      
      if (files.includes('light-jazz.mp3') && files.includes('light-jazz-fallback.mp3')) {
        // Удаляем дублирующиеся файлы
        fs.unlinkSync(path.join(audioDir, 'light-jazz.mp3'));
        console.log('Удален дублирующийся файл: light-jazz.mp3');
        
        fs.unlinkSync(path.join(audioDir, 'light-jazz-fallback.mp3'));
        console.log('Удален дублирующийся файл: light-jazz-fallback.mp3');
      }
    }
    
    console.log('Проверка звуковых файлов завершена');
    return true;
  } catch (error) {
    console.error('Ошибка при исправлении проблем со звуками:', error);
    return false;
  }
}

/**
 * Главная функция запуска скрипта
 */
async function main() {
  try {
    console.log('Запуск очистки базы данных от дубликатов...');
    
    // Подключаемся к базе данных
    await client.connect();
    console.log('Подключение к базе данных установлено');
    
    // Шаг 1: Удаляем дубликаты NFT
    const removedDuplicates = await removeDuplicateNFTs();
    
    // Шаг 2: Проверяем согласованность коллекций
    const { baycId, maycId } = await checkCollectionsConsistency();
    
    // Шаг 3: Исправляем пути к изображениям
    const fixedPaths = await fixImagePaths(baycId, maycId);
    
    // Шаг 4: Исправляем проблемы со звуками
    const fixedSounds = await fixSoundIssues();
    
    // Выводим итоги очистки
    console.log('\nИтоги очистки:');
    console.log(`- Удалено дубликатов NFT: ${removedDuplicates}`);
    console.log(`- Исправлено путей к изображениям: ${fixedPaths}`);
    console.log(`- Исправлены проблемы со звуками: ${fixedSounds ? 'Да' : 'Нет'}`);
    
    console.log('\nОчистка успешно завершена!');
  } catch (error) {
    console.error('Ошибка при выполнении очистки:', error);
  } finally {
    // Закрываем соединение с базой данных
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем основную функцию
main().catch(console.error);