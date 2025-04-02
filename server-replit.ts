/**
 * Специальный скрипт для запуска сервера на Replit
 * Обеспечивает работу на порту 5000 и запуск NFT сервера
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createServer } from './server/index';

// Необходимые константы
const NFT_SERVER_SCRIPT = 'start-nft-server.js';
const PORT = 5000;
const HOST = '0.0.0.0';

// Функции логирования
function logInfo(message: string) {
  console.log(`[INFO] ${message}`);
}

function logSuccess(message: string) {
  console.log(`[SUCCESS] ${message}`);
}

function logWarning(message: string) {
  console.log(`[WARNING] ${message}`);
}

function logErr(message: string, error?: any) {
  console.error(`[ERROR] ${message}`);
  if (error) console.error(error);
}

// Запуск NFT сервера (отдельный процесс)
function startNFTServer() {
  logInfo('Запуск NFT сервера...');
  
  // Запускаем NFT сервер в отдельном процессе
  const nftServer = spawn('node', [NFT_SERVER_SCRIPT], {
    stdio: 'inherit'
  });
  
  nftServer.on('error', (err) => {
    logErr('Ошибка запуска NFT сервера', err);
  });
  
  // Проверяем, запустился ли NFT сервер (через 5 секунд проверяем созданный файл с портом)
  setTimeout(() => {
    try {
      if (fs.existsSync('nft-server-port.txt')) {
        const port = fs.readFileSync('nft-server-port.txt', 'utf8').trim();
        logSuccess(`NFT сервер запущен на порту ${port}`);
      } else {
        logWarning('Файл с портом NFT сервера не найден, но продолжаем...');
      }
    } catch (err) {
      logWarning('Не удалось проверить порт NFT сервера');
    }
  }, 5000);
  
  return nftServer;
}

// Запуск всех сервисов
async function main() {
  // Устанавливаем обработчики для необработанных ошибок
  process.on('uncaughtException', (error) => {
    console.error('🚨 КРИТИЧЕСКАЯ ОШИБКА (uncaughtException):', error);
    logErr('Необработанное исключение', error);
    // Не завершаем процесс, чтобы приложение продолжало работать
  });

  process.on('unhandledRejection', (reason: any) => {
    console.error('🚨 НЕОБРАБОТАННЫЙ PROMISE (unhandledRejection):', reason);
    logErr('Необработанный promise', 
           reason instanceof Error ? reason.message : String(reason));
    // Не завершаем процесс, чтобы приложение продолжало работать
  });

  console.log('🌟 Запуск NFT Marketplace на Replit');
  
  // 1. Запускаем NFT сервер
  startNFTServer();
  
  // 2. Даем время на запуск NFT сервера
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 3. Запускаем основной сервер с помощью экспортированной функции
  logInfo('Запуск основного сервера...');
  try {
    const server = await createServer({ port: PORT, host: HOST });
    logSuccess(`Сервер успешно запущен на порту ${PORT}`);
    return server;
  } catch (error) {
    logErr('Ошибка при запуске сервера', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Запускаем всё
main().catch(error => {
  console.error('❌ Критическая ошибка при запуске:', error);
  process.exit(1);
});