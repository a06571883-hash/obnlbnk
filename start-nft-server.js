/**
 * Отдельный скрипт для запуска NFT сервера изображений
 * Запускается напрямую из командной строки
 */

// Запускаем NFT сервер напрямую
import('./server/nft-image-server.js')
  .then(() => {
    console.log('NFT Image Server модуль загружен');
  })
  .catch(err => {
    console.error('Ошибка при запуске NFT Image Server:', err);
    process.exit(1);
  });