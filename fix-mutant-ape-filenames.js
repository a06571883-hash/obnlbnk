/**
 * Скрипт для исправления имен файлов Mutant Ape 
 * Текущая проблема: все файлы имеют имя bored_ape_*.png
 * Необходимо переименовать в mutant_ape_*.png 
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директория с изображениями Mutant Ape
const mutantApeDir = path.join(process.cwd(), 'mutant_ape_nft');

async function fixMutantApeFilenames() {
  console.log('\n===== Начало исправления имен файлов Mutant Ape =====\n');

  // Проверяем существование директории
  if (!fs.existsSync(mutantApeDir)) {
    console.error(`Ошибка: Директория ${mutantApeDir} не существует`);
    return;
  }

  // Получаем список всех файлов
  const files = fs.readdirSync(mutantApeDir);
  console.log(`Найдено ${files.length} файлов в директории ${mutantApeDir}`);

  // Фильтруем только файлы Bored Ape для переименования
  const boredApeFiles = files.filter(file => file.startsWith('bored_ape_'));
  console.log(`Найдено ${boredApeFiles.length} файлов с префиксом 'bored_ape_'`);

  // Если нет файлов для переименования, выходим
  if (boredApeFiles.length === 0) {
    console.log('Нет файлов для переименования, выходим...');
    return;
  }

  // Переименовываем файлы
  let renamedCount = 0;
  let errorCount = 0;

  for (const filename of boredApeFiles) {
    try {
      // Получаем число из имени файла
      const match = filename.match(/bored_ape_(\d+)\.png/);
      if (!match) {
        console.log(`  Пропуск файла ${filename} - нет числа в имени`);
        continue;
      }

      const number = match[1];
      const newFilename = `mutant_ape_${number}.png`;
      const oldPath = path.join(mutantApeDir, filename);
      const newPath = path.join(mutantApeDir, newFilename);

      // Проверяем, существует ли уже файл с новым именем
      if (fs.existsSync(newPath)) {
        console.log(`  Пропуск файла ${filename} - файл ${newFilename} уже существует`);
        continue;
      }

      // Переименовываем файл
      fs.renameSync(oldPath, newPath);
      renamedCount++;

      // Выводим логи о переименовании для первых 5 файлов и каждого сотого
      if (renamedCount <= 5 || renamedCount % 100 === 0) {
        console.log(`  Переименован файл: ${filename} -> ${newFilename}`);
      }
    } catch (error) {
      console.error(`  Ошибка при переименовании файла ${filename}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n===== Результаты переименования =====`);
  console.log(`- Всего файлов для переименования: ${boredApeFiles.length}`);
  console.log(`- Успешно переименовано: ${renamedCount}`);
  console.log(`- Ошибок при переименовании: ${errorCount}`);
  console.log(`- Осталось файлов с префиксом 'bored_ape_': ${boredApeFiles.length - renamedCount}`);

  // Повторно проверяем количество файлов после переименования
  const updatedFiles = fs.readdirSync(mutantApeDir);
  const updatedBoredApeFiles = updatedFiles.filter(file => file.startsWith('bored_ape_')).length;
  const updatedMutantApeFiles = updatedFiles.filter(file => file.startsWith('mutant_ape_')).length;

  console.log(`\nИтоговое состояние директории ${mutantApeDir}:`);
  console.log(`- Всего файлов: ${updatedFiles.length}`);
  console.log(`- Файлов с префиксом 'bored_ape_': ${updatedBoredApeFiles}`);
  console.log(`- Файлов с префиксом 'mutant_ape_': ${updatedMutantApeFiles}`);
  console.log('\nОперация успешно завершена!');
}

// Запускаем скрипт
fixMutantApeFilenames().catch(console.error);