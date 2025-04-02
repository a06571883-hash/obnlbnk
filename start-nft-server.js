/**
 * Отдельный скрипт для запуска NFT сервера изображений
 * Запускается напрямую из командной строки
 * Обновлен для корректной обработки PNG изображений из директории nft_assets/mutant_ape
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверяем наличие и создаем директорию nft_assets/mutant_ape, если она не существует
const nftAssetsMutantApePath = path.join(process.cwd(), 'nft_assets', 'mutant_ape');
if (!fs.existsSync(nftAssetsMutantApePath)) {
  try {
    fs.mkdirSync(nftAssetsMutantApePath, { recursive: true });
    console.log(`Создана директория: ${nftAssetsMutantApePath}`);
  } catch (err) {
    console.error(`Ошибка при создании директории ${nftAssetsMutantApePath}:`, err);
  }
}

// Запускаем NFT сервер напрямую
import('./server/nft-image-server.js')
  .then(() => {
    console.log('NFT Image Server модуль загружен');
  })
  .catch(err => {
    console.error('Ошибка при запуске NFT Image Server:', err);
    process.exit(1);
  });