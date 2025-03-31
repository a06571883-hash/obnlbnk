/**
 * Скрипт для очистки базы данных от существующих Mutant Ape NFT
 * и импорта новых оригинальных NFT с OpenSea
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const { Pool } = pg;

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Константы
const COLLECTION_NAME = 'Mutant Ape Yacht Club';
const MUTANT_APE_DIRECTORY = './mutant_ape_official';

/**
 * Удаляет все NFT из коллекции Mutant Ape Yacht Club
 */
async function cleanMutantApeNFTs() {
  console.log('Очистка существующих Mutant Ape NFT...');
  
  const client = await pool.connect();
  try {
    // Находим ID коллекции MAYC
    const collectionResult = await client.query(
      'SELECT id FROM nft_collections WHERE name LIKE $1',
      ['%Mutant Ape%']
    );
    
    if (collectionResult.rows.length === 0) {
      console.log('Коллекция Mutant Ape не найдена, нечего очищать.');
      return;
    }
    
    const collectionId = collectionResult.rows[0].id;
    console.log(`Найдена коллекция Mutant Ape с ID ${collectionId}`);
    
    // Подсчитываем количество NFT в коллекции
    const countResult = await client.query(
      'SELECT COUNT(*) FROM nfts WHERE collection_id = $1',
      [collectionId]
    );
    
    const nftCount = parseInt(countResult.rows[0].count);
    console.log(`В коллекции найдено ${nftCount} NFT.`);
    
    if (nftCount === 0) {
      console.log('Нет NFT для удаления.');
      return;
    }
    
    // Сохраняем список путей к изображениям перед удалением
    const imagePathsResult = await client.query(
      'SELECT image_path FROM nfts WHERE collection_id = $1',
      [collectionId]
    );
    
    const imagePaths = imagePathsResult.rows.map(row => row.image_path);
    
    // Удаляем NFT из коллекции
    const deleteResult = await client.query(
      'DELETE FROM nfts WHERE collection_id = $1 RETURNING id',
      [collectionId]
    );
    
    console.log(`Удалено ${deleteResult.rowCount} NFT из коллекции Mutant Ape.`);
    
    return {
      collectionId,
      imagePaths
    };
  } catch (error) {
    console.error('Ошибка при очистке коллекции:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Создает директорию для новых изображений, если она не существует
 */
function createImageDirectory() {
  if (!fs.existsSync(MUTANT_APE_DIRECTORY)) {
    console.log(`Создание директории для изображений: ${MUTANT_APE_DIRECTORY}`);
    fs.mkdirSync(MUTANT_APE_DIRECTORY, { recursive: true });
  } else {
    console.log(`Директория ${MUTANT_APE_DIRECTORY} уже существует.`);
  }
}

/**
 * Запускает скрипт импорта официальных NFT
 */
async function importOfficialMAYC() {
  console.log('Запуск импорта официальных Mutant Ape NFT...');
  
  try {
    const { stdout, stderr } = await execPromise('node import-official-mayc.js');
    console.log('Результат импорта:');
    console.log(stdout);
    
    if (stderr) {
      console.error('Ошибки при импорте:');
      console.error(stderr);
    }
  } catch (error) {
    console.error('Ошибка при запуске скрипта импорта:', error);
    throw error;
  }
}

/**
 * Обновляет пути к изображениям NFT в базе данных
 */
async function updateImagePaths() {
  console.log('Обновление путей к изображениям в базе данных...');
  
  const client = await pool.connect();
  try {
    // Находим ID коллекции MAYC
    const collectionResult = await client.query(
      'SELECT id FROM nft_collections WHERE name LIKE $1',
      ['%Mutant Ape%']
    );
    
    if (collectionResult.rows.length === 0) {
      console.log('Коллекция Mutant Ape не найдена.');
      return;
    }
    
    const collectionId = collectionResult.rows[0].id;
    
    // Подсчитываем количество NFT с некорректными путями
    const countResult = await client.query(`
      SELECT COUNT(*) FROM nfts 
      WHERE collection_id = $1 
      AND image_path NOT LIKE '/mutant_ape_official/%'
    `, [collectionId]);
    
    const invalidPathsCount = parseInt(countResult.rows[0].count);
    console.log(`Найдено ${invalidPathsCount} NFT с некорректными путями к изображениям.`);
    
    if (invalidPathsCount === 0) {
      console.log('Все пути к изображениям корректны.');
      return;
    }
    
    // Обновляем пути к изображениям
    const updateResult = await client.query(`
      UPDATE nfts 
      SET image_path = CONCAT('/mutant_ape_official/mutant_ape_', LPAD(token_id, 4, '0'), '.png')
      WHERE collection_id = $1 
      AND image_path NOT LIKE '/mutant_ape_official/%'
      RETURNING id
    `, [collectionId]);
    
    console.log(`Обновлено ${updateResult.rowCount} путей к изображениям.`);
  } catch (error) {
    console.error('Ошибка при обновлении путей к изображениям:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Проверяет корректность импорта
 */
async function validateImport() {
  console.log('Проверка результатов импорта...');
  
  const client = await pool.connect();
  try {
    // Находим ID коллекции MAYC
    const collectionResult = await client.query(
      'SELECT id FROM nft_collections WHERE name LIKE $1',
      ['%Mutant Ape%']
    );
    
    if (collectionResult.rows.length === 0) {
      console.log('Коллекция Mutant Ape не найдена.');
      return false;
    }
    
    const collectionId = collectionResult.rows[0].id;
    
    // Подсчитываем количество NFT в коллекции
    const countResult = await client.query(
      'SELECT COUNT(*) FROM nfts WHERE collection_id = $1',
      [collectionId]
    );
    
    const nftCount = parseInt(countResult.rows[0].count);
    console.log(`В коллекции найдено ${nftCount} NFT.`);
    
    // Проверяем наличие физических файлов изображений
    const imagePathsResult = await client.query(
      'SELECT image_path FROM nfts WHERE collection_id = $1 LIMIT 10',
      [collectionId]
    );
    
    let filesExist = true;
    for (const row of imagePathsResult.rows) {
      const imagePath = row.image_path;
      const filePath = path.join(process.cwd(), imagePath.replace(/^\//, ''));
      
      if (!fs.existsSync(filePath)) {
        console.warn(`Файл ${filePath} не существует!`);
        filesExist = false;
      }
    }
    
    if (filesExist) {
      console.log('Проверка файлов изображений: OK');
    } else {
      console.warn('Некоторые файлы изображений отсутствуют!');
    }
    
    return nftCount > 0 && filesExist;
  } catch (error) {
    console.error('Ошибка при проверке импорта:', error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log('Начало процесса очистки и импорта Mutant Ape Yacht Club...');
    
    // Шаг 1: Очищаем существующие Mutant Ape NFT
    await cleanMutantApeNFTs();
    
    // Шаг 2: Создаем директорию для новых изображений
    createImageDirectory();
    
    // Шаг 3: Импортируем официальные NFT
    await importOfficialMAYC();
    
    // Шаг 4: Обновляем пути к изображениям
    await updateImagePaths();
    
    // Шаг 5: Проверяем результаты импорта
    const importSuccessful = await validateImport();
    
    if (importSuccessful) {
      console.log('✅ Процесс очистки и импорта Mutant Ape Yacht Club завершен успешно!');
    } else {
      console.warn('⚠️ Процесс завершен с предупреждениями, проверьте логи.');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
    console.log('Подключение к базе данных закрыто.');
  }
}

// Запускаем скрипт
main();