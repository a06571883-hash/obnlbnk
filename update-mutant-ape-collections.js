/**
 * Скрипт для полного обновления коллекций Mutant Ape Yacht Club
 * Последовательно запускает импорт официальной и обычной коллекций
 */

import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * Запускает скрипт с ожиданием его завершения
 * @param {string} scriptPath Путь к скрипту для запуска
 * @returns {Promise<string>} Вывод скрипта
 */
async function runScript(scriptPath) {
  console.log(`Запуск скрипта: ${scriptPath}`);
  try {
    const { stdout, stderr } = await execPromise(`node ${scriptPath}`);
    
    console.log('STDOUT:', stdout);
    
    if (stderr) {
      console.error('STDERR:', stderr);
    }
    
    return stdout;
  } catch (error) {
    console.error(`Ошибка при запуске скрипта ${scriptPath}:`, error);
    throw error;
  }
}

/**
 * Главная функция обновления всех коллекций Mutant Ape
 */
async function updateAllMutantApeCollections() {
  try {
    console.log('='.repeat(80));
    console.log('Начало полного обновления коллекций Mutant Ape Yacht Club');
    console.log('='.repeat(80));
    
    // Шаг 1: Обновляем официальную коллекцию Mutant Ape
    console.log('\n>> Шаг 1: Импорт официальной коллекции Mutant Ape (ID: 11)');
    await runScript('reimport-mutant-ape.js');
    
    // Шаг 2: Обновляем обычную коллекцию Mutant Ape
    console.log('\n>> Шаг 2: Импорт обычной коллекции Mutant Ape (ID: 2)');
    await runScript('reimport-regular-mutant-apes.js');
    
    // Готово!
    console.log('\n', '='.repeat(80));
    console.log('✅ Обновление всех коллекций Mutant Ape Yacht Club успешно завершено!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Ошибка при обновлении коллекций:', error);
  }
}

// Запускаем скрипт
updateAllMutantApeCollections();