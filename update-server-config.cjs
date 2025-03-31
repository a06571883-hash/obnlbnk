/**
 * Скрипт для обновления конфигурации сервера,
 * добавляющий новый путь к изображениям NFT
 */

const fs = require('fs');
const path = require('path');

/**
 * Добавляет пути к директориям изображений для сервера
 */
async function updateServerConfig() {
  console.log('Обновление конфигурации сервера для доступа к изображениям...');
  
  // Пути для обновления
  const configFiles = [
    './server/config.js',
    './server/index.ts'
  ];
  
  // Проверяем каждый файл
  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      console.log(`Проверка файла: ${configFile}`);
      
      let content = fs.readFileSync(configFile, 'utf8');
      let updated = false;
      
      // Проверка и добавление пути к nft_assets
      if (!content.includes('nft_assets')) {
        console.log('Добавление пути /nft_assets...');
        
        // Разные шаблоны для разных файлов
        if (configFile.endsWith('config.js')) {
          // Для config.js
          const imagePathsPos = content.indexOf('nftImagePaths:');
          if (imagePathsPos !== -1) {
            const lineEndPos = content.indexOf(']', imagePathsPos);
            if (lineEndPos !== -1) {
              content = content.substring(0, lineEndPos) + 
                      ", '/nft_assets'" + 
                      content.substring(lineEndPos);
              updated = true;
            }
          }
        } else if (configFile.endsWith('index.ts')) {
          // Для index.ts
          const pathsStart = content.indexOf('app.use(\'/');
          if (pathsStart !== -1) {
            const insertPoint = content.indexOf('\n', pathsStart + 50);
            if (insertPoint !== -1) {
              const newLine = "\napp.use('/nft_assets', express.static(path.join(__dirname, '../nft_assets')));\n";
              content = content.substring(0, insertPoint) + 
                      newLine + 
                      content.substring(insertPoint);
              updated = true;
            }
          }
          
          // Добавляем также маршрут для сервера изображений NFT
          const nftServerPos = content.indexOf('NFT image server running');
          if (nftServerPos !== -1) {
            const configPaths = content.indexOf('Configured paths:', nftServerPos);
            if (configPaths !== -1) {
              const endOfPaths = content.indexOf('\n', configPaths + 100);
              if (endOfPaths !== -1 && !content.includes('/nft_assets ->')) {
                const newPath = "  '/nft_assets -> " + path.join(__dirname, 'nft_assets') + "'\n";
                content = content.substring(0, endOfPaths) + 
                        newPath + 
                        content.substring(endOfPaths);
                updated = true;
              }
            }
          }
        }
        
        // Сохраняем изменения, если были обновления
        if (updated) {
          fs.writeFileSync(configFile, content);
          console.log(`Файл ${configFile} обновлен!`);
        } else {
          console.log(`Не удалось обновить ${configFile}, структура отличается от ожидаемой`);
        }
      } else {
        console.log(`В файле ${configFile} уже есть путь к /nft_assets`);
      }
    } else {
      console.log(`Файл ${configFile} не найден`);
    }
  }
  
  console.log('Обновление конфигурации завершено');
}

// Запускаем функцию обновления
updateServerConfig().then(() => {
  console.log('Скрипт завершен!');
}).catch(err => {
  console.error('Ошибка выполнения скрипта:', err);
});