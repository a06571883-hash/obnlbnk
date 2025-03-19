/**
 * Скрипт для создания резервной копии проекта
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// Получаем __dirname (в ES модулях он не доступен напрямую)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем временную директорию
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

// Имя файла архива
const timestamp = new Date().toISOString().replace(/:/g, '-');
const backupFileName = `project-backup-${timestamp}.zip`;
const backupFilePath = path.join(tmpDir, backupFileName);

// Выполняем команду tar для создания архива
console.log(`Создаем архив проекта: ${backupFilePath}`);
// Изменяем расширение с .zip на .tar.gz
const tarFilePath = backupFilePath.replace('.zip', '.tar.gz');
exec(`tar --exclude="node_modules" --exclude=".git" --exclude="tmp" -czf ${tarFilePath} .`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Ошибка при создании архива: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Ошибка: ${stderr}`);
    return;
  }
  
  console.log(`Архив успешно создан: ${tarFilePath}`);
  console.log(`Размер архива: ${(fs.statSync(tarFilePath).size / (1024 * 1024)).toFixed(2)} MB`);
  
  // Выводим информацию о том, что теперь можно скачать архив
  console.log(`\nТеперь вы можете скачать архив, используя "Files" панель в Replit.\n`);
  console.log(`Путь к архиву: ${tarFilePath}`);
});