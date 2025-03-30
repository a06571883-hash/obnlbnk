/**
 * Скрипт для автоматического импорта нескольких пакетов NFT подряд
 */

import { spawn } from 'child_process';

// Параметры импорта
const START_INDEX = parseInt(process.argv[2] || '1', 10); // Начальный индекс
const BATCH_COUNT = parseInt(process.argv[3] || '10', 10); // Количество пакетов для импорта
const BATCH_SIZE = 100; // Размер одного пакета (как в import-mutant-ape-batch.js)

/**
 * Выполняет импорт одного пакета NFT
 * @param {number} startIndex Начальный индекс для пакета
 * @returns {Promise<boolean>} Успешность импорта
 */
function importBatch(startIndex) {
  return new Promise((resolve, reject) => {
    console.log(`Запуск импорта пакета с индекса ${startIndex}...`);
    
    const importProcess = spawn('node', ['import-mutant-ape-batch.js', startIndex.toString()]);
    
    // Перенаправляем вывод процесса на консоль
    importProcess.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });
    
    importProcess.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
    
    // Обрабатываем завершение процесса
    importProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Импорт пакета с индекса ${startIndex} успешно завершен!`);
        resolve(true);
      } else {
        console.error(`Ошибка при импорте пакета с индекса ${startIndex}. Код выхода: ${code}`);
        resolve(false); // Продолжаем, несмотря на ошибку
      }
    });
    
    importProcess.on('error', (err) => {
      console.error(`Не удалось запустить процесс импорта: ${err}`);
      resolve(false);
    });
  });
}

/**
 * Главная функция скрипта
 */
async function main() {
  console.log(`Начинаем автоматический импорт ${BATCH_COUNT} пакетов NFT, начиная с индекса ${START_INDEX}`);
  
  let currentIndex = START_INDEX;
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < BATCH_COUNT; i++) {
    const batchIndex = currentIndex;
    
    console.log(`\n===== Импорт пакета ${i + 1}/${BATCH_COUNT} (индекс ${batchIndex}) =====\n`);
    
    const success = await importBatch(batchIndex);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    currentIndex += BATCH_SIZE;
  }
  
  console.log(`\n===== Импорт завершен =====`);
  console.log(`Успешно импортировано пакетов: ${successCount}`);
  console.log(`Не удалось импортировать пакетов: ${failCount}`);
  console.log(`Следующий индекс для импорта: ${currentIndex}`);
  console.log(`Для продолжения импорта выполните команду: node auto-import-batches.js ${currentIndex} ${BATCH_COUNT}`);
}

// Запускаем скрипт
main();