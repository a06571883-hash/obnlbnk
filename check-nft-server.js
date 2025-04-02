/**
 * Скрипт для проверки работоспособности NFT-сервера
 * Проверяет доступность сервера и наличие файлов в директориях
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Порт NFT сервера (читаем из файла конфигурации)
const NFT_SERVER_PORT_FILE = path.join(__dirname, 'nft-server-port.txt');
let NFT_SERVER_PORT = 8081; // По умолчанию

// Читаем порт из файла, если он существует
if (fs.existsSync(NFT_SERVER_PORT_FILE)) {
  try {
    const portStr = fs.readFileSync(NFT_SERVER_PORT_FILE, 'utf8').trim();
    const port = parseInt(portStr, 10);
    if (!isNaN(port) && port > 1024 && port < 65535) {
      NFT_SERVER_PORT = port;
      console.log(`💡 Загружен порт NFT сервера из файла: ${NFT_SERVER_PORT}`);
    } else {
      console.log(`⚠️ Некорректный порт в файле: ${portStr}, используем порт по умолчанию: ${NFT_SERVER_PORT}`);
    }
  } catch (err) {
    console.error(`❌ Ошибка при чтении порта из файла: ${err.message}`);
  }
} else {
  console.log(`ℹ️ Файл с портом не найден, используем порт по умолчанию: ${NFT_SERVER_PORT}`);
}

// Директории с изображениями NFT
const DIRECTORIES = {
  'bored_ape_nft': path.join(process.cwd(), 'bored_ape_nft'),
  'mutant_ape_nft': path.join(process.cwd(), 'mutant_ape_nft'),
  'mutant_ape_official': path.join(process.cwd(), 'mutant_ape_official'),
  'nft_assets/mutant_ape': path.join(process.cwd(), 'nft_assets', 'mutant_ape')
};

// Проверяем доступность NFT сервера
function checkServerAvailability() {
  console.log(`🔍 Проверка доступности NFT сервера на порту ${NFT_SERVER_PORT}...`);
  
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: 'localhost',
      port: NFT_SERVER_PORT,
      path: '/status',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const status = JSON.parse(data);
            console.log(`✅ NFT сервер работает нормально: ${status.message}`);
            resolve(status);
          } catch (err) {
            console.error(`❌ Ошибка при разборе ответа: ${err.message}`);
            reject(err);
          }
        } else {
          console.error(`❌ Сервер вернул ошибку: ${res.statusCode}`);
          reject(new Error(`Server responded with status code ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`❌ Ошибка при подключении к NFT серверу: ${err.message}`);
      reject(err);
    });
    
    req.on('timeout', () => {
      console.error(`❌ Таймаут при подключении к NFT серверу`);
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    req.end();
  });
}

// Проверяем наличие файлов в директориях
function checkDirectories() {
  console.log(`🔍 Проверка директорий с изображениями NFT...`);
  
  const stats = {};
  let totalFiles = 0;
  let totalPNG = 0;
  let totalSVG = 0;
  
  for (const [dirName, dirPath] of Object.entries(DIRECTORIES)) {
    if (fs.existsSync(dirPath)) {
      try {
        const files = fs.readdirSync(dirPath);
        const pngFiles = files.filter(f => f.endsWith('.png'));
        const svgFiles = files.filter(f => f.endsWith('.svg'));
        
        stats[dirName] = {
          total: files.length,
          png: pngFiles.length,
          svg: svgFiles.length
        };
        
        totalFiles += files.length;
        totalPNG += pngFiles.length;
        totalSVG += svgFiles.length;
        
        console.log(`📂 ${dirName}: ${files.length} файлов (${pngFiles.length} PNG, ${svgFiles.length} SVG)`);
      } catch (err) {
        console.error(`❌ Ошибка при чтении директории ${dirName}: ${err.message}`);
        stats[dirName] = { error: err.message };
      }
    } else {
      console.warn(`⚠️ Директория не найдена: ${dirName} (${dirPath})`);
      stats[dirName] = { error: 'Directory not found' };
    }
  }
  
  console.log(`📊 Итого: ${totalFiles} файлов (${totalPNG} PNG, ${totalSVG} SVG)`);
  return stats;
}

// Проверяем доступность тестового изображения
async function checkSampleImage() {
  console.log(`🔍 Проверка доступности тестового изображения...`);
  
  // Выбираем первое изображение из mutant_ape_nft для проверки
  const mutantApeDir = DIRECTORIES['mutant_ape_nft'];
  if (!fs.existsSync(mutantApeDir)) {
    console.error(`❌ Директория mutant_ape_nft не найдена`);
    return false;
  }
  
  try {
    const files = fs.readdirSync(mutantApeDir);
    const pngFiles = files.filter(f => f.endsWith('.png'));
    
    if (pngFiles.length === 0) {
      console.error(`❌ В директории mutant_ape_nft нет PNG файлов`);
      return false;
    }
    
    const sampleFile = pngFiles[0];
    const sampleUrl = `http://localhost:${NFT_SERVER_PORT}/mutant_ape_nft/${sampleFile}`;
    
    console.log(`📋 Проверка доступа к файлу: ${sampleUrl}`);
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: 'localhost',
        port: NFT_SERVER_PORT,
        path: `/mutant_ape_nft/${sampleFile}`,
        method: 'GET',
        timeout: 3000
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const contentType = res.headers['content-type'];
            console.log(`✅ Изображение доступно: ${sampleFile} (${contentType})`);
            resolve(true);
          } else {
            console.error(`❌ Сервер вернул ошибку: ${res.statusCode}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', (err) => {
        console.error(`❌ Ошибка при доступе к изображению: ${err.message}`);
        resolve(false);
      });
      
      req.on('timeout', () => {
        console.error(`❌ Таймаут при доступе к изображению`);
        req.destroy();
        resolve(false);
      });
      
      req.end();
    });
  } catch (err) {
    console.error(`❌ Ошибка при проверке изображения: ${err.message}`);
    return false;
  }
}

// Основная функция проверки
async function checkNFTServer() {
  console.log('🚀 Запуск проверки NFT сервера...');
  
  try {
    // Проверяем директории
    const dirStats = checkDirectories();
    
    // Проверяем доступность сервера
    try {
      const serverStatus = await checkServerAvailability();
      console.log(`📡 Статус сервера: ${JSON.stringify(serverStatus, null, 2)}`);
    } catch (err) {
      console.error(`❌ Сервер недоступен: ${err.message}`);
      console.log(`💡 Попробуйте запустить сервер командой: node start-nft-server.js`);
    }
    
    // Проверяем доступность тестового изображения
    const imageAvailable = await checkSampleImage();
    
    // Выводим общий результат
    console.log('\n📋 Итоговый результат проверки:');
    if (imageAvailable) {
      console.log('✅ NFT сервер работает корректно, изображения доступны');
    } else {
      console.log('⚠️ NFT сервер работает, но есть проблемы с доступом к изображениям');
    }
  } catch (err) {
    console.error(`❌ Ошибка при проверке: ${err.message}`);
  }
}

// Запускаем проверку
checkNFTServer();