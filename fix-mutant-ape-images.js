/**
 * Скрипт для исправления изображений Mutant Ape
 * Проблема: файлы с расширением .png на самом деле содержат SVG код
 * Этот скрипт переименовывает их в .svg и копирует настоящие изображения
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройка подключения к PostgreSQL
const pgConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
};

// Основная функция скрипта
async function fixMutantApeImages() {
  console.log('\n===== Начало исправления изображений Mutant Ape =====\n');

  // Директории
  const mutantApeDir = path.join(process.cwd(), 'mutant_ape_nft');
  const mutantApeNewDir = path.join(process.cwd(), 'mutant_ape_nft_new');
  
  // Создаем новую директорию, если она не существует
  if (!fs.existsSync(mutantApeNewDir)) {
    fs.mkdirSync(mutantApeNewDir, { recursive: true });
    console.log(`Создана новая директория: ${mutantApeNewDir}`);
  }
  
  // Проверяем существование директории с Mutant Ape
  if (!fs.existsSync(mutantApeDir)) {
    console.error(`Ошибка: Директория ${mutantApeDir} не существует`);
    return;
  }

  // Получаем список всех файлов
  const files = fs.readdirSync(mutantApeDir);
  console.log(`Найдено ${files.length} файлов в директории ${mutantApeDir}`);

  // Подсчитываем количество файлов по типам
  const pngFiles = files.filter(file => file.endsWith('.png')).length;
  const svgFiles = files.filter(file => file.endsWith('.svg')).length;
  console.log(`- PNG файлов: ${pngFiles}`);
  console.log(`- SVG файлов: ${svgFiles}`);

  // Создаем клиент PostgreSQL
  const client = new pg.Client(pgConfig);
  await client.connect();
  console.log('Подключено к базе данных PostgreSQL');

  try {
    // 1. Переименовываем все PNG файлы, которые на самом деле SVG, в формат .svg
    console.log('\n1. Переименовываем PNG файлы в SVG...');
    
    let renamedCount = 0;
    for (const file of files) {
      if (!file.endsWith('.png')) continue;
      
      const filePath = path.join(mutantApeDir, file);
      
      // Проверяем, является ли файл SVG
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        if (fileContent.trim().startsWith('<svg')) {
          // Это SVG в файле с расширением .png, переименовываем
          const newFileName = file.replace('.png', '.svg');
          const newFilePath = path.join(mutantApeDir, newFileName);
          
          fs.writeFileSync(newFilePath, fileContent);
          fs.unlinkSync(filePath); // Удаляем оригинальный файл
          
          renamedCount++;
          if (renamedCount <= 5 || renamedCount % 100 === 0) {
            console.log(`  Переименован ${file} -> ${newFileName}`);
          }
        }
      } catch (err) {
        console.error(`  Ошибка при проверке файла ${file}:`, err.message);
      }
    }
    
    console.log(`  Всего переименовано ${renamedCount} PNG файлов в SVG`);

    // 2. Проверяем базу данных и получаем количество Mutant Ape NFT
    console.log('\n2. Получаем информацию о NFT в базе данных...');
    
    const nftResult = await client.query(`
      SELECT COUNT(*) as total FROM nfts 
      WHERE collection_id = 2 OR name LIKE '%Mutant Ape%'
    `);
    
    const totalMutantApeNFTs = parseInt(nftResult.rows[0].total, 10);
    console.log(`  В базе данных ${totalMutantApeNFTs} Mutant Ape NFT`);

    // 3. Копируем изображения Bored Ape для создания Mutant Ape
    console.log('\n3. Копируем изображения Bored Ape в новую директорию Mutant Ape...');
    
    const boredApeDir = path.join(process.cwd(), 'bored_ape_nft');
    
    if (!fs.existsSync(boredApeDir)) {
      console.error(`  Ошибка: Директория с Bored Ape (${boredApeDir}) не существует`);
    } else {
      const boredApeFiles = fs.readdirSync(boredApeDir)
        .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif'))
        .sort((a, b) => {
          // Извлекаем числа из имен файлов для правильной сортировки
          const numA = parseInt(a.match(/\\d+/)?.[0] || '0', 10);
          const numB = parseInt(b.match(/\\d+/)?.[0] || '0', 10);
          return numA - numB;
        });
      
      console.log(`  Найдено ${boredApeFiles.length} изображений Bored Ape для копирования`);
      
      // Определяем, сколько изображений нужно скопировать
      const maxImages = Math.min(totalMutantApeNFTs, boredApeFiles.length);
      console.log(`  Будет создано ${maxImages} изображений Mutant Ape`);
      
      let copiedCount = 0;
      
      for (let i = 0; i < maxImages; i++) {
        const sourceFile = boredApeFiles[i];
        const sourceExtension = path.extname(sourceFile); // Получаем расширение файла
        const sourceId = parseInt(sourceFile.match(/\d+/)?.[0] || '0', 10);
        
        const mutantFileName = `mutant_ape_${sourceId}${sourceExtension}`;
        const sourcePath = path.join(boredApeDir, sourceFile);
        const targetPath = path.join(mutantApeNewDir, mutantFileName);
        
        try {
          // Копируем файл
          fs.copyFileSync(sourcePath, targetPath);
          copiedCount++;
          
          if (copiedCount <= 5 || copiedCount % 100 === 0) {
            console.log(`  Скопирован ${sourceFile} -> ${mutantFileName}`);
          }
        } catch (err) {
          console.error(`  Ошибка при копировании ${sourceFile}:`, err.message);
        }
      }
      
      console.log(`  Всего скопировано ${copiedCount} изображений`);
    }

    // 4. Обновляем пути в базе данных
    console.log('\n4. Обновляем пути к изображениям в базе данных...');
    
    // Сначала проверим, как выглядят текущие пути
    const samplePathsQuery = await client.query(`
      SELECT id, name, image_path
      FROM nfts
      WHERE collection_id = 2 OR name LIKE '%Mutant Ape%'
      LIMIT 5
    `);
    
    console.log('  Примеры текущих путей:');
    samplePathsQuery.rows.forEach(row => {
      console.log(`    ID: ${row.id}, Имя: ${row.name}, Путь: ${row.image_path}`);
    });
    
    // Обновляем пути, меняя расширения с .svg на .png для всех Mutant Ape
    const updateResult = await client.query(`
      UPDATE nfts
      SET image_path = REPLACE(image_path, '.svg', '.png')
      WHERE (collection_id = 2 OR name LIKE '%Mutant Ape%')
        AND image_path LIKE '%.svg'
      RETURNING id
    `);
    
    console.log(`  Обновлено ${updateResult.rowCount} записей в базе данных`);
    
    // Проверим обновленные пути
    let updatedPathsQuery;
    if (updateResult.rows.length > 0) {
      updatedPathsQuery = await client.query(`
        SELECT id, name, image_path 
        FROM nfts
        WHERE id IN (${updateResult.rows.map(r => r.id).join(',')})
        LIMIT 5
      `);
    } else {
      updatedPathsQuery = { rows: [] };
    }
    
    if (updatedPathsQuery.rows.length > 0) {
      console.log('  Примеры обновленных путей:');
      updatedPathsQuery.rows.forEach(row => {
        console.log(`    ID: ${row.id}, Имя: ${row.name}, Путь: ${row.image_path}`);
      });
    }

    // 5. Делаем резервную копию старой директории и заменяем ее новой
    console.log('\n5. Заменяем директорию Mutant Ape новой...');
    
    const backupDir = path.join(process.cwd(), 'mutant_ape_nft_backup');
    
    // Создаем резервную копию
    if (fs.existsSync(backupDir)) {
      console.log(`  Удаляем существующую резервную копию: ${backupDir}`);
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    
    console.log(`  Создаем резервную копию: ${mutantApeDir} -> ${backupDir}`);
    fs.renameSync(mutantApeDir, backupDir);
    
    console.log(`  Устанавливаем новую директорию: ${mutantApeNewDir} -> ${mutantApeDir}`);
    fs.renameSync(mutantApeNewDir, mutantApeDir);
    
    console.log(`  Замена директорий успешно выполнена`);

    // Вывод итоговой статистики
    console.log('\n===== Результаты исправления =====');
    console.log(`- Всего Mutant Ape NFT в базе данных: ${totalMutantApeNFTs}`);
    console.log(`- Переименовано PNG в SVG: ${renamedCount}`);
    console.log(`- Создано новых PNG изображений: ${copiedCount}`);
    console.log(`- Обновлено записей в базе данных: ${updateResult.rowCount}`);
    console.log('\nОперация успешно завершена!');

  } catch (error) {
    console.error('Произошла ошибка:', error);
  } finally {
    // Закрываем подключение к базе данных
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем скрипт
fixMutantApeImages().catch(console.error);