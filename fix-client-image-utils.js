/**
 * Скрипт для обновления клиентского модуля обработки изображений
 * Включает отладочный режим и добавляет дополнительную обработку для NFT Mutant Ape
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к файлу обработки изображений на клиенте
const CLIENT_IMAGE_UTILS_PATH = path.join(process.cwd(), 'client', 'src', 'lib', 'image-utils.ts');

/**
 * Обновляет клиентский файл обработки изображений с исправлениями для Mutant Ape
 */
function updateClientImageUtils() {
  console.log('🚀 Начинаем обновление обработчика изображений на клиенте...');
  
  // Проверяем существование файла
  if (!fs.existsSync(CLIENT_IMAGE_UTILS_PATH)) {
    console.error(`❌ Файл не найден: ${CLIENT_IMAGE_UTILS_PATH}`);
    return false;
  }
  
  // Читаем содержимое файла
  const originalContent = fs.readFileSync(CLIENT_IMAGE_UTILS_PATH, 'utf8');
  
  // Включаем DEBUG_MODE для диагностики
  let updatedContent = originalContent.replace(/const DEBUG_MODE = (false|true);/g, 'const DEBUG_MODE = true;');
  
  if (updatedContent === originalContent) {
    console.log('⚠️ DEBUG_MODE не найден в файле, либо уже включен');
  } else {
    console.log('✅ DEBUG_MODE включен для диагностики');
  }
  
  // Проверяем поддержку Mutant Ape директорий
  let needsMutantApeUpdate = true;
  
  if (updatedContent.includes('nft_assets/mutant_ape')) {
    console.log('✅ Обработка путей nft_assets/mutant_ape уже реализована');
    needsMutantApeUpdate = false;
  }
  
  if (updatedContent.includes('mutant_ape_nft')) {
    console.log('✅ Обработка путей mutant_ape_nft уже реализована');
    needsMutantApeUpdate = false;
  }
  
  if (updatedContent.includes('mutant_ape_official')) {
    console.log('✅ Обработка путей mutant_ape_official уже реализована');
    needsMutantApeUpdate = false;
  }
  
  if (needsMutantApeUpdate) {
    // Находим функцию определения коллекции
    const detectCollectionTypeRegex = /function detectCollectionType\(imagePath: string\): NFTCollectionType \{[\s\S]*?\}/;
    const detectCollectionTypeMatch = updatedContent.match(detectCollectionTypeRegex);
    
    if (detectCollectionTypeMatch) {
      const oldDetectFunction = detectCollectionTypeMatch[0];
      
      // Обновленная версия функции с поддержкой всех типов Mutant Ape
      const newDetectFunction = `function detectCollectionType(imagePath: string): NFTCollectionType {
  if (!imagePath) return NFTCollectionType.OTHER;
  
  if (imagePath.includes('mutant_ape_official')) {
    return NFTCollectionType.MUTANT_APE_OFFICIAL;
  } else if (imagePath.includes('mutant_ape_nft') || imagePath.includes('nft_assets/mutant_ape') || imagePath.includes('mutant_ape')) {
    return NFTCollectionType.MUTANT_APE;
  } else if (imagePath.includes('bored_ape_nft') || imagePath.includes('bayc_official')) {
    return NFTCollectionType.BORED_APE;
  }
  
  return NFTCollectionType.OTHER;
}`;
      
      // Заменяем функцию
      updatedContent = updatedContent.replace(oldDetectFunction, newDetectFunction);
      console.log('✅ Обновлена функция определения коллекции с поддержкой всех вариантов Mutant Ape');
    }
    
    // Ищем блок обработки Mutant Ape в функции проксирования
    const mutantApeHandlingRegex = /case NFTCollectionType\.MUTANT_APE[\s\S]*?break;/;
    const mutantApeHandlingMatch = updatedContent.match(mutantApeHandlingRegex);
    
    if (mutantApeHandlingMatch) {
      const oldMutantApeHandling = mutantApeHandlingMatch[0];
      
      // Обновленный блок с поддержкой разных папок
      const newMutantApeHandling = `case NFTCollectionType.MUTANT_APE:
    case NFTCollectionType.MUTANT_APE_OFFICIAL: {
      const nftNumber = extractNFTNumber(imagePath);
      const isOfficial = collectionType === NFTCollectionType.MUTANT_APE_OFFICIAL;
      
      // Специальные параметры для гарантированной загрузки Mutant Ape NFT
      // Определяем директорию на основе пути и типа коллекции
      let imageDir = 'mutant_ape_nft';
      if (isOfficial) {
        imageDir = 'mutant_ape_official';
      } else if (imagePath.includes('nft_assets/mutant_ape')) {
        imageDir = 'nft_assets/mutant_ape';
      }
      
      const enhancedPath = \`/nft-proxy\${imagePath}?v=\${timestamp}&r=\${random}&collection=\${isOfficial ? 'official' : 'mutant'}&nocache=true&mutant=true&n=\${nftNumber}&force=true&dir=\${imageDir}\`;
      
      if (DEBUG_MODE) {
        console.log(\`\${isOfficial ? '🔵' : '🟢'} MUTANT APE \${isOfficial ? '(OFFICIAL)' : ''} #\${nftNumber}: \${imagePath} -> \${enhancedPath}, dir=\${imageDir}\`);
      }
      
      return enhancedPath;
    }
    break;`;
      
      // Заменяем блок
      updatedContent = updatedContent.replace(oldMutantApeHandling, newMutantApeHandling);
      console.log('✅ Обновлен блок обработки Mutant Ape с поддержкой всех директорий');
    }
  }
  
  // Сохраняем изменения в файл, если они были внесены
  if (updatedContent !== originalContent) {
    fs.writeFileSync(CLIENT_IMAGE_UTILS_PATH, updatedContent, 'utf8');
    console.log(`✅ Файл ${CLIENT_IMAGE_UTILS_PATH} успешно обновлен`);
    return true;
  } else {
    console.log(`ℹ️ Файл ${CLIENT_IMAGE_UTILS_PATH} не требует обновления`);
    return false;
  }
}

/**
 * Главная функция скрипта
 */
function main() {
  updateClientImageUtils();
}

// Запускаем скрипт
main();