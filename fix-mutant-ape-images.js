/**
 * Скрипт для исправления изображений NFT коллекции Mutant Ape
 * Обеспечивает, что все NFT с коллекцией Mutant Ape имеют правильные пути к изображениям
 */
import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Функция, которая генерирует случайное целое число в диапазоне
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🧩 Начинаем исправление изображений для коллекции Mutant Ape...');

  try {
    // Проверяем наличие директорий с изображениями Mutant Ape
    const directories = [
      'mutant_ape_nft',
      'mutant_ape_official'
    ];

    const availableImages = [];

    // Проверяем все директории и собираем пути к изображениям
    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir);
      
      if (fs.existsSync(dirPath)) {
        console.log(`📁 Проверяем директорию: ${dirPath}`);
        
        const files = fs.readdirSync(dirPath)
          .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.avif'));
        
        console.log(`Найдено ${files.length} изображений в директории ${dir}`);
        
        // Добавляем все пути к изображениям в общий список
        files.forEach(file => {
          availableImages.push(`/${dir}/${file}`);
        });
      } else {
        console.log(`⚠️ Директория не найдена: ${dirPath}`);
      }
    }

    console.log(`🖼️ Всего найдено ${availableImages.length} изображений Mutant Ape`);

    if (availableImages.length === 0) {
      console.log('❌ Нет доступных изображений Mutant Ape. Невозможно продолжить.');
      return;
    }

    // Получаем все NFT из коллекции Mutant Ape
    console.log('🔍 Получаем список всех NFT коллекции Mutant Ape...');
    
    const mutantApeNftsResult = await pool.query(`
      SELECT n.id, n.token_id, c.name as collection_name, n.image_path
      FROM nfts n
      JOIN nft_collections c ON n.collection_id = c.id
      WHERE c.name LIKE '%Mutant%'
    `);
    
    console.log(`Найдено ${mutantApeNftsResult.rows.length} NFT в коллекции Mutant Ape`);

    if (mutantApeNftsResult.rows.length === 0) {
      console.log('⚠️ NFT коллекции Mutant Ape не найдены в базе данных.');
      return;
    }

    // Исправляем пути к изображениям для всех NFT коллекции Mutant Ape
    console.log('🔧 Исправляем пути к изображениям...');
    
    let updatedCount = 0;
    
    for (const nft of mutantApeNftsResult.rows) {
      // Проверяем, правильный ли путь (должен содержать mutant)
      if (!nft.image_path || !nft.image_path.toLowerCase().includes('mutant')) {
        // Выбираем случайное изображение из доступных
        const randomIndex = getRandomInt(0, availableImages.length - 1);
        const newImageUrl = availableImages[randomIndex];
        
        console.log(`Обновляем NFT #${nft.id} (${nft.token_id}): ${nft.image_path || 'нет изображения'} -> ${newImageUrl}`);
        
        // Обновляем путь к изображению в базе данных
        await pool.query(
          'UPDATE nfts SET image_path = $1 WHERE id = $2',
          [newImageUrl, nft.id]
        );
        
        updatedCount++;
      }
    }
    
    console.log(`✅ Обновлено ${updatedCount} из ${mutantApeNftsResult.rows.length} NFT в коллекции Mutant Ape`);
    
    // Проверяем итоговое состояние
    const finalCheckResult = await pool.query(`
      SELECT n.id, n.token_id, c.name as collection_name, n.image_path
      FROM nfts n
      JOIN nft_collections c ON n.collection_id = c.id
      WHERE c.name LIKE '%Mutant%' AND (n.image_path NOT LIKE '%mutant%' OR n.image_path IS NULL)
    `);
    
    if (finalCheckResult.rows.length > 0) {
      console.log(`⚠️ Все еще есть ${finalCheckResult.rows.length} NFT с неправильными путями:`);
      finalCheckResult.rows.forEach(nft => {
        console.log(`- NFT #${nft.id} (${nft.token_id}): ${nft.image_path || 'нет пути'}`);
      });
    } else {
      console.log('🎉 Все NFT коллекции Mutant Ape имеют правильные пути к изображениям!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

main();