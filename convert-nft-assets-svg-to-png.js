/**
 * Скрипт для преобразования SVG файлов в PNG для Mutant Ape в nft_assets/mutant_ape
 * Использует canvas для рендеринга SVG и сохранения в формате PNG
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import canvas from '@napi-rs/canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директория с SVG файлами
const sourceDir = path.join(process.cwd(), 'nft_assets', 'mutant_ape');

// Функция для преобразования SVG в PNG
async function convertSvgToPng(svgPath, pngPath) {
  try {
    // Читаем содержимое SVG файла
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // Создаем элемент Image из canvas
    const image = new canvas.Image();
    
    // Преобразуем SVG в data URL
    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    
    // Загружаем SVG как изображение
    image.src = svgDataUrl;
    
    // Создаем canvas с размерами изображения
    const cnv = canvas.createCanvas(800, 800);
    const ctx = cnv.getContext('2d');
    
    // Рисуем изображение на canvas
    ctx.drawImage(image, 0, 0, 800, 800);
    
    // Сохраняем canvas как PNG
    const pngBuffer = cnv.toBuffer('image/png');
    fs.writeFileSync(pngPath, pngBuffer);
    
    console.log(`Успешно конвертировано: ${path.basename(svgPath)} -> ${path.basename(pngPath)}`);
    return true;
  } catch (error) {
    console.error(`Ошибка при конвертации ${svgPath}: ${error.message}`);
    return false;
  }
}

// Функция для преобразования всех SVG в директории
async function convertAllSvgToPng() {
  // Проверяем, существует ли директория
  if (!fs.existsSync(sourceDir)) {
    console.error(`Директория не существует: ${sourceDir}`);
    return;
  }
  
  // Получаем список всех SVG файлов
  const files = fs.readdirSync(sourceDir).filter(file => file.endsWith('.svg'));
  console.log(`Найдено ${files.length} SVG файлов для конвертации`);
  
  let successCount = 0;
  
  // Обрабатываем каждый файл
  for (const file of files) {
    const svgPath = path.join(sourceDir, file);
    const pngPath = path.join(sourceDir, file.replace('.svg', '.png'));
    
    // Если PNG уже существует, пропускаем
    if (fs.existsSync(pngPath)) {
      console.log(`PNG уже существует для ${file}, пропускаем...`);
      continue;
    }
    
    const success = await convertSvgToPng(svgPath, pngPath);
    if (success) successCount++;
  }
  
  console.log(`Конвертация завершена. Успешно конвертировано ${successCount} из ${files.length} файлов.`);
}

// Запускаем преобразование
convertAllSvgToPng().catch(error => {
  console.error('Произошла ошибка:', error);
});