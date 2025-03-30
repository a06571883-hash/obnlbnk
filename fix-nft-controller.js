/**
 * Скрипт для исправления фильтрации NFT в контроллере
 * Правильно определяет NFT из коллекций Bored Ape и Mutant Ape
 */

import fs from 'fs';
import path from 'path';

// Путь к файлу контроллера
const controllerPath = './server/controllers/nft-controller.ts';

// Функция обновления isBoredApe
function updateIsBoredApeFunction() {
  console.log('Обновление функции isBoredApe в контроллере NFT...');
  
  // Читаем текущий файл контроллера
  let content = fs.readFileSync(controllerPath, 'utf8');
  
  // Ищем все вхождения функции isBoredApe
  const isBoredApeRegex = /const isBoredApe = \(nft: any\): boolean => {[\s\S]+?return nameCheck[\s\S]+?};/g;
  
  // Новая функция определения NFT
  const newIsBoredApeFunction = `const isBoredApe = (nft: any): boolean => {
      // Проверяем, какой тип NFT
      const isNftMutant = isMutantApe(nft);
      const isNftBored = isRegularBoredApe(nft);
      
      // Оба типа считаются обезьянами, которые должны отображаться в маркетплейсе
      return isNftMutant || isNftBored;
    };
    
    // Функция для определения Mutant Ape
    const isMutantApe = (nft: any): boolean => {
      // Проверка по имени NFT
      const nameCheck = nft.name?.toLowerCase().includes('mutant ape');
      
      // Проверка по пути к изображению
      const imageCheck = nft.imagePath?.includes('mutant_ape') || 
                          nft.imageUrl?.includes('mutant_ape') || 
                          nft.image_url?.includes('mutant_ape');
      
      return nameCheck || imageCheck;
    };
    
    // Функция для определения Bored Ape (не Mutant)
    const isRegularBoredApe = (nft: any): boolean => {
      // Проверка по имени NFT (содержит 'Bored Ape', но не 'Mutant')
      const nameCheck = nft.name?.toLowerCase().includes('bored ape') &&
                        !nft.name?.toLowerCase().includes('mutant');
      
      // Проверка по пути к изображению
      const imageCheck = (nft.imagePath?.includes('bored_ape') || 
                          nft.imageUrl?.includes('bored_ape') || 
                          nft.image_url?.includes('bored_ape') ||
                          nft.imagePath?.includes('bayc_') || 
                          nft.imageUrl?.includes('bayc_') || 
                          nft.image_url?.includes('bayc_')) &&
                         !(nft.imagePath?.includes('mutant') || 
                           nft.imageUrl?.includes('mutant') || 
                           nft.image_url?.includes('mutant'));
      
      return nameCheck || imageCheck;
    };`;
  
  // Заменяем все вхождения функции на новую
  const updatedContent = content.replace(isBoredApeRegex, newIsBoredApeFunction);
  
  // Сохраняем изменения в файл
  fs.writeFileSync(controllerPath, updatedContent, 'utf8');
  
  console.log('Функция isBoredApe успешно обновлена');
}

// Функция для увеличения лимита NFT в маркетплейсе
function increaseNFTLimit() {
  console.log('Увеличение лимита NFT в маркетплейсе...');
  
  // Читаем текущий файл контроллера
  let content = fs.readFileSync(controllerPath, 'utf8');
  
  // Заменяем все ограничения лимита
  content = content.replace(/\.limit\(1000\)/g, '.limit(5000)');
  
  // Сохраняем изменения в файл
  fs.writeFileSync(controllerPath, content, 'utf8');
  
  console.log('Лимит NFT успешно увеличен до 5000');
}

// Функция для обеспечения показа всех типов NFT
function ensureAllNFTTypesShown() {
  console.log('Обновление фильтрации NFT для отображения всех типов...');
  
  // Читаем текущий файл контроллера
  let content = fs.readFileSync(controllerPath, 'utf8');
  
  // Находим строки с фильтрацией
  const filterRegex = /const onlyBoredApes = (\w+)\.filter\(nft => isBoredApe\(nft\)\);/g;
  
  // Заменяем фильтрацию на отображение всех NFT
  const updatedContent = content.replace(filterRegex, 'const onlyBoredApes = $1; // Показываем все типы NFT');
  
  // Сохраняем изменения в файл
  fs.writeFileSync(controllerPath, updatedContent, 'utf8');
  
  console.log('Фильтрация NFT обновлена для отображения всех типов');
}

// Главная функция скрипта
async function main() {
  try {
    console.log('Запуск скрипта исправления NFT контроллера...');
    
    // Создаем резервную копию контроллера
    const backupPath = `${controllerPath}.bak`;
    fs.copyFileSync(controllerPath, backupPath);
    console.log(`Создана резервная копия контроллера: ${backupPath}`);
    
    // Шаг 1: Обновляем функцию isBoredApe
    updateIsBoredApeFunction();
    
    // Шаг 2: Увеличиваем лимит NFT в маркетплейсе
    increaseNFTLimit();
    
    // Шаг 3: Обновляем фильтрацию для отображения всех типов NFT
    ensureAllNFTTypesShown();
    
    console.log('Все операции завершены успешно!');
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  }
}

main();