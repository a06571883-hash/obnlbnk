/**
 * Файл для запуска NFT сервера
 * Читает порт из файла nft-server-port.txt и запускает сервер на этом порту
 */

import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к файлу с номером порта NFT сервера
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

// Запускаем NFT сервер
console.log(`🚀 Запуск NFT сервера на порту ${NFT_SERVER_PORT}...`);

const nftServer = spawn('node', ['run-nft-server.js'], {
  env: { ...process.env, NFT_SERVER_PORT: NFT_SERVER_PORT.toString() }
});

nftServer.stdout.on('data', (data) => {
  console.log(`[NFT Server] ${data}`);
});

nftServer.stderr.on('data', (data) => {
  console.error(`[NFT Server Error] ${data}`);
});

nftServer.on('close', (code) => {
  console.log(`[NFT Server] Процесс завершен с кодом ${code}`);
});

// Обработчики сигналов для правильного завершения
process.on('SIGINT', () => {
  console.log('Получен сигнал SIGINT, завершаем работу NFT сервера...');
  nftServer.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM, завершаем работу NFT сервера...');
  nftServer.kill('SIGTERM');
  process.exit(0);
});