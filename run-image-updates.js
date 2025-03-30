/**
 * Скрипт для автоматического запуска нескольких пакетов обновления изображений
 */
import { execSync } from 'child_process';

// Параметры запуска
const START_ID = 7100; // Начальный ID
const BATCH_SIZE = 200; // Размер пакета
const NUM_BATCHES = 5; // Количество пакетов для обработки

// Функция задержки
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для запуска одного пакета
async function runBatch(startId) {
  try {
    console.log(`Запуск пакета начиная с ID ${startId}...`);
    
    // Запускаем скрипт обновления изображений
    const output = execSync(`node fix-nft-images.js ${startId} ${BATCH_SIZE} --single`, { encoding: 'utf8' });
    
    // Выводим сокращенный результат
    const lines = output.split('\n');
    const importantLines = lines.filter(line => 
      line.includes('Пакет обработан:') || 
      line.includes('Последний обработанный ID:') ||
      line.includes('Скрипт успешно выполнен.')
    );
    
    console.log(importantLines.join('\n'));
    console.log('Пакет успешно обработан.\n');
    
    return true;
  } catch (error) {
    console.error(`Ошибка при обработке пакета начиная с ID ${startId}:`, error.message);
    return false;
  }
}

// Основная функция
async function main() {
  console.log(`Запуск обновления изображений для ${NUM_BATCHES} пакетов по ${BATCH_SIZE} NFT`);
  console.log(`Начальный ID: ${START_ID}\n`);
  
  let currentId = START_ID;
  let successCount = 0;
  
  for (let i = 0; i < NUM_BATCHES; i++) {
    console.log(`--- Пакет ${i + 1} из ${NUM_BATCHES} ---`);
    
    const success = await runBatch(currentId);
    
    if (success) {
      successCount++;
      currentId += BATCH_SIZE;
    } else {
      // При ошибке пробуем повторить с текущего ID через небольшую паузу
      await sleep(2000);
      i--; // Уменьшаем счетчик, чтобы повторить попытку
    }
    
    // Добавляем паузу между пакетами
    await sleep(1000);
  }
  
  console.log(`\nОбработка завершена! Успешно обработано пакетов: ${successCount} из ${NUM_BATCHES}`);
  console.log(`Следующий стартовый ID для продолжения обработки: ${currentId}`);
}

// Запускаем скрипт
main();