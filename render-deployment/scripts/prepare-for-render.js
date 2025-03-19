/**
 * Скрипт для подготовки приложения к деплою на Render.com
 * - Создает директорию data для постоянного хранилища
 * - Копирует базу данных в директорию data
 * - Создает резервные копии базы данных
 * - Проверяет наличие всех необходимых файлов
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = path.resolve(__dirname, '..');

// Пути к важным файлам
const DATA_DIR = path.join(cwd, 'data');
const DB_PATH = path.join(cwd, 'sqlite.db');
const RENDER_DB_PATH = path.join(DATA_DIR, 'sqlite.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');
const RENDER_YAML_PATH = path.join(cwd, 'render.yaml');
const BUILD_SCRIPT_PATH = path.join(cwd, 'build.sh');
const START_SCRIPT_PATH = path.join(cwd, 'start.sh');

// Убедимся, что все необходимые директории существуют
function ensureDirectories() {
  console.log('\n=== Проверка и создание директорий ===');
  
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`Создание директории ${DATA_DIR}...`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } else {
    console.log(`Директория ${DATA_DIR} существует`);
  }
  
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log(`Создание директории ${BACKUP_DIR}...`);
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } else {
    console.log(`Директория ${BACKUP_DIR} существует`);
  }
}

// Копирование базы данных в директорию data
function copyDatabase() {
  console.log('\n=== Копирование базы данных ===');
  
  if (!fs.existsSync(DB_PATH)) {
    console.log(`ОШИБКА: База данных ${DB_PATH} не найдена`);
    return false;
  }
  
  try {
    fs.copyFileSync(DB_PATH, RENDER_DB_PATH);
    console.log(`База данных успешно скопирована в ${RENDER_DB_PATH}`);
    
    // Создаем дополнительную резервную копию
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.db`);
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`Резервная копия создана в ${backupPath}`);
    
    return true;
  } catch (error) {
    console.error('Ошибка при копировании базы данных:', error);
    return false;
  }
}

// Проверка наличия всех необходимых файлов для Render.com
function checkRenderFiles() {
  console.log('\n=== Проверка файлов для Render.com ===');
  
  const requiredFiles = [
    { path: RENDER_YAML_PATH, name: 'render.yaml', description: 'Конфигурация инфраструктуры Render.com' },
    { path: BUILD_SCRIPT_PATH, name: 'build.sh', description: 'Скрипт сборки для Render.com' },
    { path: START_SCRIPT_PATH, name: 'start.sh', description: 'Скрипт запуска для Render.com' }
  ];
  
  let missingFiles = false;
  
  for (const file of requiredFiles) {
    if (fs.existsSync(file.path)) {
      console.log(`✅ ${file.name} найден (${file.description})`);
    } else {
      console.log(`❌ ${file.name} отсутствует (${file.description})`);
      missingFiles = true;
    }
  }
  
  if (missingFiles) {
    console.log('\nВНИМАНИЕ: Некоторые файлы для Render.com отсутствуют!');
    console.log('Убедитесь, что вы создали все необходимые файлы перед деплоем.');
  } else {
    console.log('\nВсе необходимые файлы для Render.com присутствуют.');
  }
  
  return !missingFiles;
}

// Проверка готовности к деплою
function checkDeployReadiness() {
  console.log('\n=== Проверка готовности к деплою ===');
  
  // Проверка базы данных
  if (!fs.existsSync(RENDER_DB_PATH)) {
    console.log('❌ База данных не скопирована в директорию data');
    return false;
  } else {
    console.log('✅ База данных готова для Render.com');
  }
  
  // Проверка файлов package.json на наличие нужных скриптов
  const packageJsonPath = path.join(cwd, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (packageJson.scripts && packageJson.scripts.build && packageJson.scripts.start) {
        console.log('✅ package.json содержит необходимые скрипты build и start');
      } else {
        console.log('❌ В package.json отсутствуют необходимые скрипты build и/или start');
        return false;
      }
    } catch (error) {
      console.error('Ошибка при проверке package.json:', error);
      return false;
    }
  } else {
    console.log('❌ package.json не найден');
    return false;
  }
  
  return true;
}

// Выполнение всех проверок и подготовки
function prepareForRender() {
  console.log('=== Подготовка к деплою на Render.com ===');
  
  ensureDirectories();
  const dbCopied = copyDatabase();
  const filesExist = checkRenderFiles();
  const isReady = checkDeployReadiness();
  
  console.log('\n=== Итоги подготовки ===');
  
  if (dbCopied && filesExist && isReady) {
    console.log('✅ Приложение готово к деплою на Render.com!');
    console.log('\nДля деплоя выполните следующие шаги:');
    console.log('1. Загрузите проект на GitHub');
    console.log('2. Создайте новый Web Service на Render.com, указав при этом:');
    console.log('   - Source: ваш репозиторий GitHub');
    console.log('   - Branch: main (или другая ветка с кодом)');
    console.log('   - Runtime: Node.js');
    console.log('   - Build Command: chmod +x build.sh && ./build.sh');
    console.log('   - Start Command: chmod +x start.sh && ./start.sh');
    console.log('3. Создайте Disk Volume и укажите путь /opt/render/project/src/data');
    console.log('4. Добавьте переменные окружения:');
    console.log('   - NODE_ENV=production');
    console.log('   - RENDER=true');
    console.log('   - TELEGRAM_BOT_TOKEN=ваш_токен_бота');
    console.log('5. Нажмите "Create Web Service"');
  } else {
    console.log('❌ Приложение НЕ готово к деплою на Render.com');
    console.log('Пожалуйста, исправьте указанные выше проблемы и запустите скрипт снова.');
  }
}

// Запускаем проверку
prepareForRender();