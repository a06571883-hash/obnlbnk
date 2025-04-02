/**
 * Скрипт для пакетного преобразования SVG файлов в PNG для Mutant Ape в nft_assets/mutant_ape
 * Использует canvas для рендеринга SVG и сохранения в формате PNG
 * Обрабатывает файлы небольшими партиями, чтобы избежать тайм-аутов
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import canvas from '@napi-rs/canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директория с SVG файлами
const sourceDir = path.join(process.cwd(), 'nft_assets', 'mutant_ape');

// Размер пакета - сколько файлов обрабатывать за один раз
const BATCH_SIZE = 25;

// Диапазон файлов для обработки (указывайте числа как аргументы командной строки)
let START_INDEX = 0;
let END_INDEX = BATCH_SIZE;

// Получение диапазона из аргументов командной строки
const args = process.argv.slice(2);
if (args.length >= 1) {
  START_INDEX = parseInt(args[0], 10);
}
if (args.length >= 2) {
  END_INDEX = parseInt(args[1], 10);
}

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

// Функция для преобразования пакета SVG файлов
async function convertBatchSvgToPng() {
  // Проверяем, существует ли директория
  if (!fs.existsSync(sourceDir)) {
    console.error(`Директория не существует: ${sourceDir}`);
    return;
  }
  
  // Получаем список всех SVG файлов
  const allFiles = fs.readdirSync(sourceDir).filter(file => file.endsWith('.svg'));
  console.log(`Всего найдено ${allFiles.length} SVG файлов`);
  
  // Выбираем только файлы в указанном диапазоне
  const files = allFiles.slice(START_INDEX, END_INDEX);
  console.log(`Обрабатываем пакет от ${START_INDEX} до ${END_INDEX} (${files.length} файлов)`);
  
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
  
  console.log(`Конвертация пакета завершена. Успешно конвертировано ${successCount} из ${files.length} файлов.`);
  console.log(`Для конвертации следующего пакета запустите: node convert-nft-assets-batch.js ${END_INDEX} ${END_INDEX + BATCH_SIZE}`);
}

// Запускаем преобразование
convertBatchSvgToPng().catch(error => {
  console.error('Произошла ошибка:', error);
});