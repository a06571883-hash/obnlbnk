/**
 * Скрипт для автоматического импорта нескольких пакетов BAYC NFT подряд
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Запускает импорт одного пакета и ждет его завершения
 * @param {number} startIndex Начальный индекс пакета
 * @returns {Promise<Object>} Результат выполнения команды
 */
async function importBatch(startIndex) {
  console.log(`Запуск импорта пакета #${startIndex / 200 + 1}, начиная с индекса ${startIndex}`);
  try {
    const { stdout, stderr } = await execAsync(`node import-bayc-batch.js ${startIndex} 200`);
    console.log(`Результат импорта пакета #${startIndex / 200 + 1}:`);
    console.log(stdout);
    if (stderr) {
      console.error(`Ошибки: ${stderr}`);
    }
    return { success: true, stderr, stdout };
  } catch (error) {
    console.error(`Ошибка при импорте пакета #${startIndex / 200 + 1}:`, error);
    return { success: false, error };
  }
}

/**
 * Выполняет паузу между запросами
 * @param {number} ms Время паузы в миллисекундах
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Главная функция скрипта
 */
async function main() {
  // Устанавливаем параметры импорта
  const startBatchNumber = 0;  // С какого пакета начать (0 - самый первый)
  const batchesToRun = 50;     // Сколько пакетов выполнить (50 пакетов по 200 = 10,000 NFT)
  const batchSize = 200;       // Размер каждого пакета
  const pauseTime = 500;       // Пауза между пакетами в миллисекундах
  
  console.log(`Начинаем импорт ${batchesToRun} пакетов BAYC NFT...`);
  console.log(`Параметры: размер пакета=${batchSize}, пауза=${pauseTime}ms`);
  
  for (let i = 0; i < batchesToRun; i++) {
    const startIndex = (startBatchNumber + i) * batchSize;
    
    // Импортируем пакет
    const result = await importBatch(startIndex);
    
    // Проверяем результат
    if (!result.success) {
      console.error(`Импорт пакета #${i + 1} завершился с ошибкой. Прерываем выполнение.`);
      break;
    }
    
    // Извлекаем общее количество NFT из вывода
    const totalMatch = result.stdout.match(/Всего в коллекции: (\d+)/);
    const total = totalMatch ? parseInt(totalMatch[1]) : null;
    
    // Если достигли 10,000 NFT или близко к этому, останавливаемся
    if (total && total >= 9950) {
      console.log(`Достигнуто достаточное количество NFT (${total}). Завершаем импорт.`);
      break;
    }
    
    // Делаем паузу перед следующим пакетом
    if (i < batchesToRun - 1) {
      console.log(`Пауза ${pauseTime}ms перед следующим пакетом...`);
      await delay(pauseTime);
    }
  }
  
  console.log('Импорт BAYC NFT завершен!');
}

// Запускаем главную функцию
main().catch(console.error);