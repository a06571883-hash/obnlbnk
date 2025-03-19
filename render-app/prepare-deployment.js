/**
 * Скрипт для подготовки деплоя на Render.com
 * Проверяет наличие всех необходимых файлов и зависимостей
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Цвета для вывода
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

console.log(`${BLUE}Проверка готовности проекта к деплою на Render.com${RESET}`);

// Список необходимых файлов
const requiredFiles = [
  'build.sh',
  'start.sh',
  'setup-telegram.js',
  'check-status.sh',
  'render.yaml',
  'package.json',
  'RENDER_DEPLOYMENT_GUIDE.md',
  'DATABASE_BACKUP_RESTORE.md'
];

// Список директорий
const requiredDirectories = [
  'client',
  'server',
  'shared'
];

// Список скриптов в package.json
const requiredScripts = [
  'build',
  'start',
  'dev',
  'webhook:setup'
];

// Проверка файлов
console.log(`\n${BLUE}Проверка необходимых файлов:${RESET}`);
let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`${GREEN}✅ ${file} - найден${RESET}`);
    
    // Проверка прав на исполнение для sh-файлов
    if (file.endsWith('.sh')) {
      try {
        fs.accessSync(filePath, fs.constants.X_OK);
        console.log(`${GREEN}  ✓ Файл имеет права на исполнение${RESET}`);
      } catch (err) {
        console.log(`${YELLOW}  ⚠️ Файл не имеет прав на исполнение. Добавляем...${RESET}`);
        try {
          fs.chmodSync(filePath, '755');
          console.log(`${GREEN}  ✓ Права на исполнение успешно добавлены${RESET}`);
        } catch (err) {
          console.log(`${RED}  ✗ Не удалось добавить права на исполнение: ${err.message}${RESET}`);
        }
      }
    }
  } else {
    console.log(`${RED}❌ ${file} - не найден${RESET}`);
    allFilesExist = false;
  }
});

// Проверка директорий
console.log(`\n${BLUE}Проверка необходимых директорий:${RESET}`);
let allDirectoriesExist = true;
requiredDirectories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    console.log(`${GREEN}✅ ${dir} - найдена${RESET}`);
  } else {
    console.log(`${RED}❌ ${dir} - не найдена${RESET}`);
    allDirectoriesExist = false;
  }
});

// Проверка package.json
console.log(`\n${BLUE}Проверка package.json:${RESET}`);
let packageJsonValid = true;
try {
  const packageJson = require('./package.json');
  
  // Проверка скриптов
  console.log(`${BLUE}Проверка скриптов:${RESET}`);
  requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`${GREEN}✅ script:${script} - найден${RESET}`);
    } else {
      console.log(`${RED}❌ script:${script} - не найден${RESET}`);
      packageJsonValid = false;
    }
  });
  
  // Проверка engines
  if (packageJson.engines && packageJson.engines.node) {
    console.log(`${GREEN}✅ engines.node: ${packageJson.engines.node}${RESET}`);
  } else {
    console.log(`${RED}❌ engines.node - не указана версия Node.js${RESET}`);
    packageJsonValid = false;
  }
  
  // Проверка зависимостей
  const criticalDependencies = [
    'express', 
    'better-sqlite3', 
    'node-fetch', 
    'react', 
    'zod', 
    'drizzle-orm',
    'typescript'
  ];
  
  console.log(`${BLUE}Проверка критических зависимостей:${RESET}`);
  criticalDependencies.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`${GREEN}✅ ${dep}: ${packageJson.dependencies[dep]}${RESET}`);
    } else {
      console.log(`${RED}❌ ${dep} - отсутствует в зависимостях${RESET}`);
      packageJsonValid = false;
    }
  });
  
} catch (err) {
  console.log(`${RED}❌ Ошибка при чтении package.json: ${err.message}${RESET}`);
  packageJsonValid = false;
}

// Проверка прав доступа на скрипты
console.log(`\n${BLUE}Проверка прав на исполнение:${RESET}`);
['build.sh', 'start.sh', 'check-status.sh'].forEach(script => {
  try {
    execSync(`chmod +x ${script}`);
    console.log(`${GREEN}✅ Права на исполнение для ${script} установлены${RESET}`);
  } catch (err) {
    console.log(`${RED}❌ Не удалось установить права на исполнение для ${script}: ${err.message}${RESET}`);
  }
});

// Итоговый результат
console.log(`\n${BLUE}Результат проверки:${RESET}`);
if (allFilesExist && allDirectoriesExist && packageJsonValid) {
  console.log(`${GREEN}✅ Проект готов к деплою на Render.com!${RESET}`);
  console.log(`\n${GREEN}Следующие шаги:${RESET}`);
  console.log(`1. Создайте новый сервис на Render.com`);
  console.log(`2. Подключите свой репозиторий`);
  console.log(`3. Укажите render-app в качестве корневой директории`);
  console.log(`4. Установите команду сборки: ./build.sh`);
  console.log(`5. Установите команду запуска: ./start.sh`);
  console.log(`6. Добавьте необходимые переменные окружения`);
  console.log(`7. Создайте диск и настройте его подключение к /data`);
  console.log(`\n${BLUE}Подробная инструкция:${RESET} RENDER_DEPLOYMENT_GUIDE.md\n`);
} else {
  console.log(`${RED}❌ Проект не готов к деплою! Исправьте указанные выше ошибки.${RESET}`);
  
  if (!allFilesExist) {
    console.log(`${YELLOW}⚠️ Отсутствуют необходимые файлы${RESET}`);
  }
  
  if (!allDirectoriesExist) {
    console.log(`${YELLOW}⚠️ Отсутствуют необходимые директории${RESET}`);
  }
  
  if (!packageJsonValid) {
    console.log(`${YELLOW}⚠️ Проблемы с package.json${RESET}`);
  }
}

// Проверка обязательных переменных окружения
console.log(`\n${BLUE}Обязательные переменные окружения для Render.com:${RESET}`);
console.log(`${YELLOW}TELEGRAM_BOT_TOKEN${RESET} - токен Telegram бота`);
console.log(`${YELLOW}NODE_ENV${RESET} - рекомендуется установить в 'production'`);
console.log(`${YELLOW}RENDER${RESET} - рекомендуется установить в 'true'`);
console.log(`${YELLOW}SESSION_SECRET${RESET} - секрет для сессий (будет сгенерирован автоматически)`);

// Финальная инструкция
console.log(`\n${GREEN}Для деплоя на Render.com следуйте инструкции в RENDER_DEPLOYMENT_GUIDE.md${RESET}`);