/**
 * Скрипт для исправления названий NFT
 * Заменяет "Mutant Ape" на "Bored Ape" для всех NFT
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Загружаем переменные окружения
dotenv.config();

// Подключение к базе данных
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? 
    { rejectUnauthorized: false } : false
};

const client = new pg.Client(dbConfig);

/**
 * Исправляет наименования всех NFT
 */
async function fixNFTNaming() {
  try {
    console.log('Подключение к базе данных...');
    await client.connect();
    console.log('Успешное подключение к базе данных');
    
    // 1. Обновляем названия NFT: Mutant Ape -> Bored Ape
    const { rowCount } = await client.query(`
      UPDATE nfts
      SET name = REPLACE(name, 'Mutant Ape', 'Bored Ape')
      WHERE name LIKE 'Mutant Ape%'
    `);
    
    console.log(`Обновлено ${rowCount} NFT из Mutant Ape в Bored Ape`);
    
    // 2. Проверяем, что обновление прошло успешно
    const { rows: countCheck } = await client.query(`
      SELECT COUNT(*) as count FROM nfts WHERE name LIKE 'Mutant Ape%'
    `);
    
    console.log(`Осталось NFT с названием Mutant Ape: ${countCheck[0].count}`);
    
    // 3. Проверим файлы в директориях с изображениями
    console.log('Проверяем директории с изображениями BAYC...');
    
    // Убедимся, что NFT использует правильные изображения
    const { rows: imagePaths } = await client.query(`
      SELECT id, image_path FROM nfts LIMIT 5
    `);
    
    console.log('Примеры текущих путей к изображениям:');
    imagePaths.forEach(nft => {
      console.log(`  NFT ID ${nft.id}: ${nft.image_path}`);
    });
    
    // Проверим, что папка с изображениями существует
    let imageDirectories = [
      'bayc_official_nft', 
      'new_bored_apes',
      'bored_ape_nft'
    ];
    
    let existingDirectories = [];
    
    for (const dir of imageDirectories) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(file => 
          file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.avif')
        );
        existingDirectories.push({
          dir,
          fileCount: files.length,
          sampleFiles: files.slice(0, 3)
        });
      }
    }
    
    console.log('Найденные директории с изображениями:');
    existingDirectories.forEach(dir => {
      console.log(`  ${dir.dir}: ${dir.fileCount} файлов. Примеры: ${dir.sampleFiles.join(', ')}`);
    });
    
    // Если есть директория с изображениями, обновим пути к изображениям
    if (existingDirectories.length > 0) {
      // Выберем директорию с наибольшим количеством файлов
      const bestDir = existingDirectories.sort((a, b) => b.fileCount - a.fileCount)[0];
      
      console.log(`Используем директорию ${bestDir.dir} для обновления путей к изображениям`);
      
      // Для каждого NFT обновим путь к изображению, используя имя файла из текущего пути
      // Сначала проверим, есть ли в директории файлы bayc_XXX.png или official_bored_ape_XXX.png
      const hasBaycFiles = fs.readdirSync(bestDir.dir).some(file => file.startsWith('bayc_'));
      const hasOfficialFiles = fs.readdirSync(bestDir.dir).some(file => file.startsWith('official_bored_ape_'));
      
      let filePattern;
      if (hasBaycFiles) {
        filePattern = 'bayc_';
        console.log('Используем шаблон имени файла: bayc_XXX.png');
      } else if (hasOfficialFiles) {
        filePattern = 'official_bored_ape_';
        console.log('Используем шаблон имени файла: official_bored_ape_XXX.png');
      } else {
        filePattern = 'bored_ape_';
        console.log('Используем шаблон имени файла: bored_ape_XXX.png/avif');
      }
      
      // Обновляем пути к изображениям, используя идентификатор токена
      const { rowCount: imageUpdateCount } = await client.query(`
        UPDATE nfts
        SET image_path = CONCAT('/${bestDir.dir}/${filePattern}', token_id, '.png')
        WHERE image_path NOT LIKE '/${bestDir.dir}/${filePattern}%'
      `);
      
      console.log(`Обновлены пути к изображениям для ${imageUpdateCount} NFT`);
      
      // Проверим обновленные пути
      const { rows: updatedPaths } = await client.query(`
        SELECT id, token_id, name, image_path FROM nfts LIMIT 5
      `);
      
      console.log('Примеры обновленных путей к изображениям:');
      updatedPaths.forEach(nft => {
        console.log(`  NFT ID ${nft.id} (Token ${nft.token_id}): ${nft.name} -> ${nft.image_path}`);
      });
    }
    
    console.log('Обновление NFT завершено успешно!');
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error.message);
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем скрипт
fixNFTNaming().catch(console.error);