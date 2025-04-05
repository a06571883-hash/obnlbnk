/**
 * Скрипт для проверки и диагностики состояния NFT маркетплейса
 * Проверяет доступность серверов, состояние директорий с изображениями
 * и правильность конфигурации
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Функция для цветного вывода
function colorLog(color, ...messages) {
  console.log(colors[color], ...messages, colors.reset);
}

// Функция для форматированного вывода результатов проверки
function printResult(test, result, details = null) {
  if (result === true) {
    colorLog('green', `✅ ${test}`);
  } else if (result === false) {
    colorLog('red', `❌ ${test}`);
    if (details) {
      console.log(`   ${details}`);
    }
  } else if (result === 'warning') {
    colorLog('yellow', `⚠️ ${test}`);
    if (details) {
      console.log(`   ${details}`);
    }
  }
}

// Функция для проверки доступности сервера
async function checkServerAvailability(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path: '/',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      resolve(res.statusCode < 500); // Считаем сервер доступным, если нет ошибки 5xx
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Функция для проверки существования директории и подсчета файлов
function checkDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return { exists: false, count: 0 };
    }
    
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return { exists: false, count: 0 };
    }
    
    const files = fs.readdirSync(dirPath).filter(
      file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.svg')
    );
    
    return { exists: true, count: files.length };
  } catch (error) {
    return { exists: false, count: 0, error: error.message };
  }
}

// Функция для проверки наличия файла
function checkFile(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

// Функция для проверки главного сервера
async function checkMainServer() {
  colorLog('bright', '\n🔍 Проверка основного сервера...');
  
  const isAvailable = await checkServerAvailability(5000);
  printResult('Основной сервер доступен на порту 5000', isAvailable);
  
  if (!isAvailable) {
    return false;
  }
  
  return true;
}

// Функция для проверки NFT сервера изображений
async function checkNFTImageServer() {
  colorLog('bright', '\n🔍 Проверка NFT сервера изображений...');
  
  let nftServerPort = 8081; // Порт по умолчанию
  
  // Проверяем, указан ли порт в файле конфигурации
  if (checkFile('./nft-server-port.txt')) {
    try {
      const portStr = fs.readFileSync('./nft-server-port.txt', 'utf8').trim();
      const port = parseInt(portStr, 10);
      if (!isNaN(port) && port > 0) {
        nftServerPort = port;
        printResult('Найден файл конфигурации порта NFT сервера', true, `Порт: ${nftServerPort}`);
      }
    } catch (error) {
      printResult('Чтение файла конфигурации порта NFT сервера', false, error.message);
    }
  } else {
    printResult('Файл конфигурации порта NFT сервера не найден', 'warning', 'Используем порт по умолчанию: 8081');
  }
  
  // Проверяем доступность NFT сервера
  const isAvailable = await checkServerAvailability(nftServerPort);
  printResult(`NFT сервер доступен на порту ${nftServerPort}`, isAvailable);
  
  return { isAvailable, port: nftServerPort };
}

// Функция для проверки директорий NFT
function checkNFTDirectories() {
  colorLog('bright', '\n🔍 Проверка директорий с изображениями NFT...');
  
  const directories = {
    'bored_ape_nft': path.join(process.cwd(), 'bored_ape_nft'),
    'mutant_ape_nft': path.join(process.cwd(), 'mutant_ape_nft'),
    'mutant_ape_official': path.join(process.cwd(), 'mutant_ape_official'),
    'nft_assets/mutant_ape': path.join(process.cwd(), 'nft_assets', 'mutant_ape')
  };
  
  let totalFiles = 0;
  let allDirectoriesExist = true;
  
  for (const [dirName, dirPath] of Object.entries(directories)) {
    const result = checkDirectory(dirPath);
    
    if (result.exists) {
      printResult(`Директория ${dirName}`, true, `Найдено файлов: ${result.count}`);
      totalFiles += result.count;
    } else {
      allDirectoriesExist = false;
      if (result.error) {
        printResult(`Директория ${dirName}`, false, `Ошибка: ${result.error}`);
      } else {
        printResult(`Директория ${dirName}`, false, `Путь: ${dirPath}`);
      }
    }
  }
  
  return { allDirectoriesExist, totalFiles };
}

// Функция для проверки файлов клиентского кода
function checkClientCode() {
  colorLog('bright', '\n🔍 Проверка клиентского кода NFT маркетплейса...');
  
  const files = {
    'image-utils.ts': './client/src/lib/image-utils.ts',
    'nft-marketplace.tsx': './client/src/components/nft/nft-marketplace.tsx',
    'nft-gallery.tsx': './client/src/components/nft/nft-gallery.tsx'
  };
  
  let allFilesExist = true;
  
  for (const [fileName, filePath] of Object.entries(files)) {
    const exists = checkFile(filePath);
    printResult(`Файл ${fileName}`, exists, exists ? null : `Путь: ${filePath}`);
    
    if (!exists) {
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

// Функция для проверки серверного кода
function checkServerCode() {
  colorLog('bright', '\n🔍 Проверка серверного кода NFT маркетплейса...');
  
  const files = {
    'nft-controller.ts': './server/controllers/nft-controller.ts',
    'nft-marketplace-controller.ts': './server/controllers/nft-marketplace-controller.ts',
    'run-nft-server.js': './run-nft-server.js'
  };
  
  let allFilesExist = true;
  
  for (const [fileName, filePath] of Object.entries(files)) {
    const exists = checkFile(filePath);
    printResult(`Файл ${fileName}`, exists, exists ? null : `Путь: ${filePath}`);
    
    if (!exists) {
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

// Функция для анализа активных процессов
function checkActiveProcesses() {
  colorLog('bright', '\n🔍 Рекомендации для анализа активных процессов...');
  console.log('Выполните следующие команды для анализа активных процессов:');
  console.log('  ps aux | grep node   - для просмотра Node.js процессов');
  console.log('  lsof -i :5000        - для проверки процесса на порту 5000');
  console.log('  lsof -i :8081        - для проверки процесса на порту 8081 (NFT сервер)');
}

// Основная функция
async function main() {
  colorLog('cyan', '\n🔬 Начало диагностики NFT маркетплейса...');
  
  const mainServerOk = await checkMainServer();
  const { isAvailable: nftServerOk, port: nftServerPort } = await checkNFTImageServer();
  const { allDirectoriesExist, totalFiles } = checkNFTDirectories();
  const clientCodeOk = checkClientCode();
  const serverCodeOk = checkServerCode();
  
  colorLog('bright', '\n📊 Сводная информация:');
  printResult('Основной сервер', mainServerOk);
  printResult('NFT сервер изображений', nftServerOk);
  printResult('Директории с изображениями', allDirectoriesExist, `Всего файлов: ${totalFiles}`);
  printResult('Клиентский код', clientCodeOk);
  printResult('Серверный код', serverCodeOk);
  
  checkActiveProcesses();
  
  // Вывод финального заключения
  console.log('\n');
  if (mainServerOk && nftServerOk && allDirectoriesExist && clientCodeOk && serverCodeOk) {
    colorLog('green', '✅ Все компоненты NFT маркетплейса в порядке!');
  } else {
    colorLog('yellow', '⚠️ Обнаружены проблемы с NFT маркетплейсом.');
    
    if (!mainServerOk) {
      colorLog('red', '  - Основной сервер недоступен');
    }
    
    if (!nftServerOk) {
      colorLog('red', '  - NFT сервер изображений недоступен');
    }
    
    if (!allDirectoriesExist) {
      colorLog('red', '  - Не все директории с изображениями существуют');
    }
    
    if (!clientCodeOk) {
      colorLog('red', '  - Проблемы с клиентским кодом');
    }
    
    if (!serverCodeOk) {
      colorLog('red', '  - Проблемы с серверным кодом');
    }
    
    if (totalFiles === 0) {
      colorLog('red', '  - Не найдено ни одного файла изображения NFT');
    }
  }
  
  console.log('\n');
}

// Запускаем диагностику
main().catch(error => {
  console.error('Ошибка при выполнении диагностики:', error);
});