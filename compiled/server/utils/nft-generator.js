/**
 * Утилита для генерации NFT изображений из коллекции Bored Ape Yacht Club
 * Использует изображения из приложенного пользователем ZIP-архива
 */
import { getBoredApeNFT, checkBoredApeNFTFiles } from './bored-ape-nft-loader';
import { createFallbackBoredApeNFT } from './bored-ape-fallback';
/**
 * Получает NFT изображение из коллекции Bored Ape Yacht Club
 * @param rarity Редкость NFT
 * @returns Путь к созданному файлу
 */
export async function generateNFTImage(rarity) {
    try {
        // Проверяем наличие файлов Bored Ape NFT
        checkBoredApeNFTFiles();
        // Используем NFT из коллекции Bored Ape
        console.log(`Получаем NFT из коллекции Bored Ape с редкостью: ${rarity}`);
        return await getBoredApeNFT(rarity);
    }
    catch (error) {
        // Если произошла ошибка, создаем запасное изображение из статических файлов
        console.log('ГЕНЕРАЦИЯ NFT: Используем запасные изображения');
        console.log(`Создание запасного изображения для редкости: ${rarity}`);
        // Создаем запасное изображение
        return createFallbackBoredApeNFT(rarity);
    }
}
/* Следующий код сохранен только для совместимости со старыми NFT:

// Статические пути к фотореалистичным изображениям для каждой редкости
    const fallbackImages: Record<NFTRarity, string[]> = {
      common: [
        'https://cdn.pixabay.com/photo/2015/06/25/17/21/smart-watch-821557_1280.jpg',
        'https://cdn.pixabay.com/photo/2016/11/29/03/53/architecture-1867187_1280.jpg',
        'https://cdn.pixabay.com/photo/2018/01/18/18/00/ferrari-3090880_1280.jpg'
      ],
      uncommon: [
        'https://cdn.pixabay.com/photo/2016/11/18/12/52/automobile-1834274_1280.jpg',
        'https://cdn.pixabay.com/photo/2015/12/19/22/32/watch-1100302_1280.jpg',
        'https://cdn.pixabay.com/photo/2018/01/15/05/23/gem-3083113_1280.jpg'
      ],
      rare: [
        'https://cdn.pixabay.com/photo/2017/03/05/15/29/aston-martin-2118857_1280.jpg',
        'https://cdn.pixabay.com/photo/2018/01/15/05/23/crystal-3083116_1280.jpg',
        'https://cdn.pixabay.com/photo/2014/07/10/17/18/large-home-389271_1280.jpg'
      ],
      epic: [
        'https://cdn.pixabay.com/photo/2016/08/13/20/33/château-1591-1593034_1280.jpg',
        'https://cdn.pixabay.com/photo/2016/01/19/16/45/car-1149997_1280.jpg',
        'https://cdn.pixabay.com/photo/2015/06/25/17/22/smart-watch-821559_1280.jpg'
      ],
      legendary: [
        'https://cdn.pixabay.com/photo/2016/08/25/14/55/diamond-1619951_1280.jpg',
        'https://cdn.pixabay.com/photo/2016/07/22/22/22/porsche-1535893_1280.jpg',
        'https://cdn.pixabay.com/photo/2018/01/04/19/43/bentley-3061642_1280.jpg'
      ]
    };
    
    // Предзагруженные локальные изображения в нашем проекте
    // Создаем и используем локальные файлы для надежности
    const fixedDir = 'client/public/assets/nft/fixed';
    const publicFixedDir = 'public/assets/nft/fixed';
    
    // Убедимся, что обе директории существуют
    if (!fs.existsSync(fixedDir)) {
      fs.mkdirSync(fixedDir, { recursive: true });
    }
    if (!fs.existsSync(publicFixedDir)) {
      fs.mkdirSync(publicFixedDir, { recursive: true });
    }
    
    // Категории предметов роскоши
    const categories = ['car', 'watch', 'diamond', 'mansion', 'cash'];
    
    // Выбираем случайную категорию
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    
    // Путь к изображениям с учетом категории
    const localImages: Record<NFTRarity, string[]> = {
      common: [
        `/assets/nft/fixed/common_luxury_car_1.jpg`,
        `/assets/nft/fixed/common_luxury_watch_1.jpg`,
        `/assets/nft/fixed/common_luxury_diamond_1.jpg`,
        `/assets/nft/fixed/common_luxury_mansion_1.jpg`
      ],
      uncommon: [
        `/assets/nft/fixed/uncommon_luxury_car_1.jpg`,
        `/assets/nft/fixed/uncommon_luxury_watch_1.jpg`,
        `/assets/nft/fixed/uncommon_luxury_diamond_1.jpg`,
        `/assets/nft/fixed/uncommon_luxury_mansion_1.jpg`
      ],
      rare: [
        `/assets/nft/fixed/rare_luxury_car_1.jpg`,
        `/assets/nft/fixed/rare_luxury_watch_1.jpg`,
        `/assets/nft/fixed/rare_luxury_diamond_1.jpg`,
        `/assets/nft/fixed/rare_luxury_mansion_1.jpg`
      ],
      epic: [
        `/assets/nft/fixed/epic_luxury_car_1.jpg`,
        `/assets/nft/fixed/epic_luxury_watch_1.jpg`,
        `/assets/nft/fixed/epic_luxury_diamond_1.jpg`,
        `/assets/nft/fixed/epic_luxury_mansion_1.jpg`
      ],
      legendary: [
        `/assets/nft/fixed/legendary_luxury_car_1.jpg`,
        `/assets/nft/fixed/legendary_luxury_watch_1.jpg`,
        `/assets/nft/fixed/legendary_luxury_diamond_1.jpg`,
        `/assets/nft/fixed/legendary_luxury_mansion_1.jpg`
      ]
    };
    
    try {
      // Создаем директорию для постоянных файлов, если она не существует
      if (!fs.existsSync(fixedDir)) {
        fs.mkdirSync(fixedDir, { recursive: true });
      }
      
      // Генерируем локальные постоянные файлы из внешних источников с добавлением уникального идентификатора
      const localImagePaths = localImages[rarity];
      
      // Гарантируем, что каждый раз выбираем новое изображение, используя дополнительную энтропию
      const randomValue = Date.now() % localImagePaths.length;
      const secondaryRandomValue = crypto.randomBytes(1)[0] % localImagePaths.length;
      const finalRandomIndex = (randomValue + secondaryRandomValue) % localImagePaths.length;
      
      let basePath = localImagePaths[finalRandomIndex];
      
      // Добавляем уникальность пути, сохраняя оригинальное расширение
      const parsedPath = path.parse(basePath);
      const timestamp = Date.now();
      const randomId = crypto.randomBytes(8).toString('hex'); // Увеличиваем энтропию
      const uniquePath = `${parsedPath.dir}/${parsedPath.name}_${timestamp}_${randomId}${parsedPath.ext}`;
      
      // Создаем пути с уникальными именами файлов
      const clientFilePath = path.join(process.cwd(), 'client/public', uniquePath);
      const publicFilePath = path.join(process.cwd(), 'public', uniquePath);
      
      // Всегда создаем новый файл с уникальным именем для каждого NFT
      console.log(`Создаю уникальное изображение для NFT (${rarity}): ${uniquePath}`);
      
      let buffer;
      try {
        // Получаем путь к оригинальному файлу
        const origFilePath = path.join(process.cwd(), 'public', basePath);
        
        if (fs.existsSync(origFilePath)) {
          // Просто копируем исходный файл без модификаций, чтобы избежать повреждения
          buffer = fs.readFileSync(origFilePath);
          console.log(`Успешно прочитан исходный файл изображения: ${basePath}`);
        } else {
          // Если файл не найден, используем Pixabay как запасной вариант
          throw new Error("Исходный файл не найден");
        }
      } catch (err) {
        // Если что-то пошло не так, используем Pixabay как запасной вариант
        const error = err as Error;
        console.log(`Ошибка при работе с исходным файлом: ${error.message}`);
        console.log('Используем Pixabay в качестве запасного источника');
        
        // Выбираем случайное изображение из Pixabay с использованием энтропии
        const randomIndex = (Date.now() % fallbackImages[rarity].length +
                          crypto.randomBytes(1)[0] % fallbackImages[rarity].length) %
                          fallbackImages[rarity].length;
        
        const randomImageUrl = fallbackImages[rarity][randomIndex];
        
        // Загружаем изображение с Pixabay
        const response = await fetch(randomImageUrl);
        if (!response.ok) {
          throw new Error(`Ошибка при загрузке изображения: ${response.statusText}`);
        }
        
        // Получаем изображение
        buffer = Buffer.from(await response.arrayBuffer());
      }
      
      // Сохраняем изображение как постоянное в обеих директориях
      
      // Сохраняем в директорию client/public
      fs.writeFileSync(clientFilePath, buffer);
      
      // И также в директорию public для доступа к файлам через веб-сервер
      fs.writeFileSync(publicFilePath, buffer);
      
      console.log(`Изображение успешно сохранено как уникальное: ${uniquePath}`);
      
      return uniquePath;
    } catch (fallbackError) {
      console.error('Ошибка при работе с локальными изображениями:', fallbackError);
      
      try {
        // Пробуем скачать новое изображение напрямую из Pixabay
        console.log('Пробуем скачать новое изображение из Pixabay...');
        
        // Используем дополнительную энтропию для выбора изображения
        const randomIndex = (Date.now() % fallbackImages[rarity].length +
                           crypto.randomBytes(1)[0] % fallbackImages[rarity].length) %
                           fallbackImages[rarity].length;
        
        const randomImageUrl = fallbackImages[rarity][randomIndex];
        
        const response = await fetch(randomImageUrl);
        if (!response.ok) {
          throw new Error(`Не удалось загрузить изображение с Pixabay: ${response.statusText}`);
        }
        
        // Сохраняем с уникальным именем, увеличиваем энтропию с длинным randomId
        const buffer = await response.arrayBuffer();
        const timestamp = Date.now();
        const randomId = crypto.randomBytes(8).toString('hex');
        const fileName = `${rarity}_luxury_${timestamp}_${randomId}.jpg`;
        const clientDir = 'client/public/assets/nft';
        const publicDir = 'public/assets/nft';
        
        // Создаем обе директории, если они не существуют
        if (!fs.existsSync(clientDir)) {
          fs.mkdirSync(clientDir, { recursive: true });
        }
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        
        // Сохраняем в обеих директориях
        const clientFilePath = path.join(process.cwd(), clientDir, fileName);
        const publicFilePath = path.join(process.cwd(), publicDir, fileName);
        
        fs.writeFileSync(clientFilePath, Buffer.from(buffer));
        fs.writeFileSync(publicFilePath, Buffer.from(buffer));
        
        console.log(`Успешно создано новое NFT изображение: /assets/nft/${fileName}`);
        return `/assets/nft/${fileName}`;
      } catch (finalError) {
        // Если все попытки не удались, используем стандартное резервное изображение
        console.error('Все попытки загрузки изображений не удались:', finalError);
        
        const baseImagePath = `/assets/nft/default_${rarity}.jpg`;
        console.log(`Используем стандартное изображение: ${baseImagePath}`);
        return baseImagePath;
      }
    }
  }
}

/**
 * Генерирует SVG-изображение в пиксельном стиле с роскошными объектами
 */
function generatePixelArtSVG(styles) {
    const { backgroundColor, primaryColor, secondaryColor, borderColor, glowColor, glowSize, theme } = styles;
    // Создаем уникальный сид для каждого изображения, чтобы избежать повторений
    // Используем Date.now() и Math.random() вместо crypto.randomBytes, чтобы избежать проблем с типами
    const seed = Math.floor(Date.now() * Math.random()).toString(16).padStart(8, '0');
    const seedNumber = parseInt(seed, 16);
    const randomGenerator = createRandomGenerator(seedNumber);
    // Базовые настройки для пиксельной сетки
    const pixelSize = 8; // Размер одного пикселя
    const gridWidth = 32; // Ширина сетки в пикселях
    const gridHeight = 32; // Высота сетки в пикселях
    // Создаем фильтр для эффекта шиммера (переливания)
    const shimmerFilter = `
    <filter id="shimmer" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="1" seed="${seedNumber % 100}">
        <animate attributeName="baseFrequency" from="0.01" to="0.02" dur="30s" repeatCount="indefinite" />
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" scale="5" />
      <feGaussianBlur stdDeviation="${glowSize / 2}" />
      <feComposite in="SourceGraphic" operator="over" />
    </filter>
  `;
    // Фильтр для металлического блеска
    const metalFilter = `
    <filter id="metal">
      <feSpecularLighting result="specOut" specularExponent="20" lighting-color="#ffffff">
        <fePointLight x="50%" y="50%" z="200" />
      </feSpecularLighting>
      <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
    </filter>
  `;
    // Функция для создания пиксельного объекта в зависимости от темы
    let pixelArt = '';
    switch (theme) {
        case 'car':
            pixelArt = generatePixelCar(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor);
            break;
        case 'yacht':
            pixelArt = generatePixelYacht(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor);
            break;
        case 'mansion':
            pixelArt = generatePixelMansion(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor);
            break;
        case 'jet':
            pixelArt = generatePixelJet(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor);
            break;
        case 'character':
            pixelArt = generatePixelCharacter(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor);
            break;
    }
    // Финальный SVG с пиксельным искусством
    return `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${shimmerFilter}
      ${metalFilter}
    </defs>
    
    <!-- Темный фон с градиентом -->
    <rect width="256" height="256" fill="${backgroundColor}" />
    <rect width="256" height="256" fill="url(#bgGradient)" />
    
    <!-- Градиент фона -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${backgroundColor}" />
      <stop offset="50%" stop-color="${adjustColor(backgroundColor, -20)}" />
      <stop offset="100%" stop-color="${backgroundColor}" />
    </linearGradient>
    
    <!-- Рамка с эффектом шиммера -->
    <rect x="8" y="8" width="240" height="240" fill="none" stroke="${glowColor}" stroke-width="2" filter="url(#shimmer)" />
    
    <!-- Пиксельное искусство по центру -->
    <g transform="translate(0, 0)">
      ${pixelArt}
    </g>
    
    <!-- Добавляем небольшие блестящие эффекты -->
    ${generateShimmerEffects(randomGenerator, pixelSize, gridWidth, gridHeight, glowColor)}
  </svg>
  `;
}
/**
 * Создает генератор случайных чисел с фиксированным семенем для повторяемости
 */
function createRandomGenerator(seed) {
    let currentSeed = seed;
    return () => {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        return currentSeed / 233280;
    };
}
/**
 * Изменяет яркость цвета на заданную величину
 */
function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
/**
 * Генерирует эффекты шиммера для пиксельного искусства
 */
function generateShimmerEffects(randomGenerator, pixelSize, gridWidth, gridHeight, glowColor) {
    let effects = '';
    // Добавляем случайные блестящие эффекты
    const numEffects = Math.floor(randomGenerator() * 15) + 5;
    for (let i = 0; i < numEffects; i++) {
        const x = Math.floor(randomGenerator() * gridWidth) * pixelSize;
        const y = Math.floor(randomGenerator() * gridHeight) * pixelSize;
        const opacity = randomGenerator() * 0.5 + 0.2;
        const size = Math.floor(randomGenerator() * 2) + 1;
        effects += `<rect x="${x}" y="${y}" width="${pixelSize * size}" height="${pixelSize * size}" fill="${glowColor}" opacity="${opacity}" filter="url(#shimmer)" />`;
    }
    return effects;
}
/**
 * Генерирует пиксельное изображение автомобиля премиум-класса
 */
function generatePixelCar(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor) {
    let pixels = '';
    // Создаем пиксельный массив для машины (1 = основной цвет, 2 = вторичный цвет, 3 = контур)
    const model = [
        "       11111111111        ",
        "      1111111111111       ",
        "     111111111111111      ",
        "    11111111111111111     ",
        "   1111111111111111111    ",
        "  111111111111111111111   ",
        " 11111111111111111111111  ",
        "11111111111111111111111113",
        "1111111111111111111111111 ",
        "1111111111111111111111111 ",
        "1111111111111111111111111 ",
        "1111222222222222222211111 ",
        "1112222222222222222221111 ",
        "1122222222222222222222111 ",
        "1111111111111111111111111 ",
        "1111111111111111111111111 ",
        "1111111111111111111111111 ",
        "1111111111111111111111111 ",
        "1111111111111111111111111 ",
        "11222211       11222211   ",
        "12222221       12222221   ",
        "12222221       12222221   ",
        "11222211       11222211   "
    ];
    // Для каждого элемента добавляем случайные вариации, чтобы машины не были одинаковыми
    const variation = Math.floor(randomGenerator() * 3);
    const variantColor = adjustColor(primaryColor, 20 + Math.floor(randomGenerator() * 30));
    // Рисуем пиксели машины
    for (let y = 0; y < model.length; y++) {
        for (let x = 0; x < model[y].length; x++) {
            const code = model[y][x];
            if (code === ' ')
                continue;
            const pixelX = (x + 4) * pixelSize;
            const pixelY = (y + 3) * pixelSize;
            let pixelColor;
            if (code === '1') {
                // Основной цвет с вариациями
                pixelColor = variation === 0 && randomGenerator() > 0.8 ? variantColor : primaryColor;
            }
            else if (code === '2') {
                // Вторичный цвет (окна, детали)
                pixelColor = secondaryColor;
            }
            else if (code === '3') {
                // Контур
                pixelColor = borderColor;
            }
            // Добавляем небольшие вариации в размере пикселей для эффекта пиксельного искусства
            const variance = 0.9 + randomGenerator() * 0.2;
            const actualSize = pixelSize * variance;
            const offset = (pixelSize - actualSize) / 2;
            pixels += `<rect x="${pixelX + offset}" y="${pixelY + offset}" width="${actualSize}" height="${actualSize}" fill="${pixelColor}" />`;
        }
    }
    // Добавляем блестящие пиксели
    for (let i = 0; i < 10; i++) {
        const x = (4 + Math.floor(randomGenerator() * 24)) * pixelSize;
        const y = (3 + Math.floor(randomGenerator() * 20)) * pixelSize;
        pixels += `<rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="white" opacity="0.5" filter="url(#metal)" />`;
    }
    return pixels;
}
/**
 * Генерирует пиксельное изображение яхты
 */
function generatePixelYacht(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor) {
    let pixels = '';
    // Базовая модель яхты в пикселях
    const model = [
        "                          ",
        "                          ",
        "            1             ",
        "           111            ",
        "          11111           ",
        "         1111111          ",
        "        111111111         ",
        "       11111111111        ",
        "      1111111111111       ",
        "     111111111111111      ",
        "    11111111111111111     ",
        "   1111111111111111111    ",
        "  111111111111111111111   ",
        " 11111111111111111111111  ",
        "11111111111111111111111113",
        "1111111111111111111111111 ",
        "1111111111111111111111111 ",
        "1111111111111111111111111 ",
        "2221111222111122211112221 ",
        "2221111222111122211112221 ",
        "1111111111111111111111111 ",
        "1111111111111111111111111 ",
        "1111111111111111111111111 "
    ];
    // Рисуем пиксели яхты
    for (let y = 0; y < model.length; y++) {
        for (let x = 0; x < model[y].length; x++) {
            const code = model[y][x];
            if (code === ' ')
                continue;
            const pixelX = (x + 4) * pixelSize;
            const pixelY = (y + 3) * pixelSize;
            let pixelColor;
            if (code === '1') {
                // Основной цвет яхты
                pixelColor = primaryColor;
            }
            else if (code === '2') {
                // Окна, детали
                pixelColor = secondaryColor;
            }
            else if (code === '3') {
                // Контур
                pixelColor = borderColor;
            }
            pixels += `<rect x="${pixelX}" y="${pixelY}" width="${pixelSize}" height="${pixelSize}" fill="${pixelColor}" />`;
        }
    }
    // Добавляем эффект воды под яхтой
    const waterBlue = '#3A7CA5';
    for (let x = 0; x < 28; x++) {
        for (let y = 22; y < 26; y++) {
            if (randomGenerator() > 0.3) {
                const pixelX = (x + 4) * pixelSize;
                const pixelY = (y + 3) * pixelSize;
                const opacity = 0.2 + randomGenerator() * 0.3;
                pixels += `<rect x="${pixelX}" y="${pixelY}" width="${pixelSize}" height="${pixelSize}" fill="${waterBlue}" opacity="${opacity}" />`;
            }
        }
    }
    return pixels;
}
/**
 * Генерирует пиксельное изображение особняка
 */
function generatePixelMansion(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor) {
    let pixels = '';
    // Модель особняка в пикселях
    const model = [
        "           11            ",
        "          1111           ",
        "         111111          ",
        "        11111111         ",
        "       1111111111        ",
        "      111111111111       ",
        "     11111111111111      ",
        "    1111111111111111     ",
        "   111111111111111111    ",
        "  11111111111111111111   ",
        " 1111111111111111111111  ",
        "111111111111111111111111 ",
        "111111111111111111111111 ",
        "111111111111111111111111 ",
        "111222111222111222111222 ",
        "111222111222111222111222 ",
        "111222111222111222111222 ",
        "111222111222111222111222 ",
        "111111111111111111111111 ",
        "111111111111111111111111 ",
        "111111111111122111111111 ",
        "111111111111122111111111 ",
        "111111111111122111111111 "
    ];
    // Рисуем пиксели особняка
    for (let y = 0; y < model.length; y++) {
        for (let x = 0; x < model[y].length; x++) {
            const code = model[y][x];
            if (code === ' ')
                continue;
            const pixelX = (x + 4) * pixelSize;
            const pixelY = (y + 3) * pixelSize;
            let pixelColor;
            if (code === '1') {
                // Основной цвет особняка
                pixelColor = primaryColor;
            }
            else if (code === '2') {
                // Окна, детали
                pixelColor = secondaryColor;
            }
            else if (code === '3') {
                // Контур
                pixelColor = borderColor;
            }
            pixels += `<rect x="${pixelX}" y="${pixelY}" width="${pixelSize}" height="${pixelSize}" fill="${pixelColor}" />`;
        }
    }
    // Добавляем элементы ландшафта
    const greenColor = '#2E7D32';
    for (let i = 0; i < 20; i++) {
        const x = (4 + Math.floor(randomGenerator() * 24)) * pixelSize;
        const y = (26 + Math.floor(randomGenerator() * 3)) * pixelSize;
        pixels += `<rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="${greenColor}" opacity="0.8" />`;
    }
    return pixels;
}
/**
 * Генерирует пиксельное изображение частного самолета
 */
function generatePixelJet(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor) {
    let pixels = '';
    // Модель самолета в пикселях
    const model = [
        "                          ",
        "                  1       ",
        "                 111      ",
        "                11111     ",
        "               1111111    ",
        "              111111111   ",
        "             11111111111  ",
        "            1111111111111 ",
        "           111111111111111",
        "          111111111111111 ",
        "      111111111111111111  ",
        "     1111111111111111111  ",
        "    11111111111111111111  ",
        "111111111111111111111111  ",
        "111111111111111111111111  ",
        "    11111111111111111111  ",
        "      11111111111111111   ",
        "        1111111111111     ",
        "                          ",
        "                          ",
        "                          ",
        "                          ",
        "                          "
    ];
    // Рисуем пиксели самолета
    for (let y = 0; y < model.length; y++) {
        for (let x = 0; x < model[y].length; x++) {
            const code = model[y][x];
            if (code === ' ')
                continue;
            const pixelX = (x + 4) * pixelSize;
            const pixelY = (y + 3) * pixelSize;
            let pixelColor = primaryColor;
            // Добавляем окна по бокам самолета
            if (y >= 10 && y <= 14 && x >= 12 && x <= 24 && x % 3 === 0) {
                pixelColor = secondaryColor;
            }
            pixels += `<rect x="${pixelX}" y="${pixelY}" width="${pixelSize}" height="${pixelSize}" fill="${pixelColor}" />`;
        }
    }
    // Добавляем облака
    const cloudColor = '#FFFFFF';
    for (let i = 0; i < 15; i++) {
        const x = (4 + Math.floor(randomGenerator() * 24)) * pixelSize;
        const y = (20 + Math.floor(randomGenerator() * 6)) * pixelSize;
        const opacity = 0.2 + randomGenerator() * 0.3;
        const size = 1 + Math.floor(randomGenerator() * 2);
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                pixels += `<rect x="${x + dx * pixelSize}" y="${y + dy * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${cloudColor}" opacity="${opacity}" />`;
            }
        }
    }
    return pixels;
}
/**
 * Генерирует пиксельное изображение персонажа-блондина
 */
function generatePixelCharacter(randomGenerator, pixelSize, primaryColor, secondaryColor, borderColor) {
    let pixels = '';
    // Основные цвета
    const hairColor = '#FFD700'; // Золотистый блонд
    const skinColor = '#FFE0B2'; // Светлый тон кожи
    // Модель персонажа в пикселях
    const model = [
        "       33333333        ",
        "      3333333333       ",
        "     333333333333      ",
        "    33333333333333     ",
        "    33322222222333     ",
        "    33222222222233     ",
        "    32222222222223     ",
        "    32222222222223     ",
        "    32222222222223     ",
        "    32222222222223     ",
        "    33222222222233     ",
        "    33322222222333     ",
        "     333333333333      ",
        "      33333333333      ",
        "      31111111113      ",
        "     3111111111113     ",
        "    311111111111113    ",
        "   31111111111111113   ",
        "   31111111111111113   ",
        "   31111111111111113   ",
        "   31111111111111113   ",
        "   31111111111111113   ",
        "   31111111111111113   "
    ];
    // Генерируем уникальные вариации для блондина
    const hairstyle = Math.floor(randomGenerator() * 3); // 3 варианта прически
    // Рисуем пиксели персонажа
    for (let y = 0; y < model.length; y++) {
        for (let x = 0; x < model[y].length; x++) {
            const code = model[y][x];
            if (code === ' ')
                continue;
            const pixelX = (x + 6) * pixelSize;
            const pixelY = (y + 3) * pixelSize;
            let pixelColor;
            if (code === '1') {
                // Тело/одежда
                pixelColor = primaryColor;
            }
            else if (code === '2') {
                // Лицо
                pixelColor = skinColor;
            }
            else if (code === '3') {
                // Волосы
                pixelColor = hairColor;
                // Вариации причесок
                if (hairstyle === 1 && y < 5 && (x < 10 || x > 18)) {
                    continue; // Более короткие волосы по бокам
                }
                else if (hairstyle === 2 && y < 4 && x > 15) {
                    continue; // Асимметричная прическа
                }
            }
            pixels += `<rect x="${pixelX}" y="${pixelY}" width="${pixelSize}" height="${pixelSize}" fill="${pixelColor}" />`;
        }
    }
    // Добавляем детали лица
    // Глаза
    pixels += `<rect x="${(12 + 6) * pixelSize}" y="${(6 + 3) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#000000" />`;
    pixels += `<rect x="${(16 + 6) * pixelSize}" y="${(6 + 3) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#000000" />`;
    // Рот
    pixels += `<rect x="${(13 + 6) * pixelSize}" y="${(9 + 3) * pixelSize}" width="${3 * pixelSize}" height="${pixelSize}" fill="#d95157" opacity="0.8" />`;
    // Добавляем аксессуары в зависимости от рандома
    const accessory = Math.floor(randomGenerator() * 5);
    if (accessory === 0) {
        // Солнцезащитные очки
        for (let i = 11; i <= 17; i++) {
            pixels += `<rect x="${(i + 6) * pixelSize}" y="${(6 + 3) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#000000" opacity="0.7" />`;
        }
    }
    else if (accessory === 1) {
        // Золотая цепочка
        for (let i = 10; i <= 19; i++) {
            pixels += `<rect x="${(i + 6) * pixelSize}" y="${(15 + 3) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${hairColor}" opacity="0.9" />`;
        }
    }
    // Добавляем эффект шиммера в волосах
    for (let i = 0; i < 8; i++) {
        const x = (8 + Math.floor(randomGenerator() * 12)) * pixelSize;
        const y = (2 + Math.floor(randomGenerator() * 5)) * pixelSize;
        pixels += `<rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="white" opacity="0.5" filter="url(#metal)" />`;
    }
    return pixels;
}
/**
 * Получает стили для NFT в зависимости от редкости
 * В роскошном реалистичном стиле с элементами премиальной жизни
 */
function getRarityStyles(rarity) {
    // Преимущественно выбираем персонажей-блондинов в ретро-стиле
    const luxuryThemes = ['character', 'character', 'character', 'character', 'character', 'character', 'car', 'yacht', 'mansion', 'jet'];
    const randomTheme = luxuryThemes[Math.floor(Math.random() * luxuryThemes.length)];
    switch (rarity) {
        case 'common':
            return {
                backgroundColor: '#1E2B3A', // Темно-синий фон, как в премиальных брендах
                primaryColor: '#C0A080', // Элегантное золото
                secondaryColor: '#647687', // Серебристо-серый
                borderColor: '#A0A0A0', // Серебряный контур
                glowColor: '#E0E0E0',
                glowSize: 2,
                complexity: 5,
                theme: randomTheme
            };
        case 'uncommon':
            return {
                backgroundColor: '#2D1A26', // Темный бордовый фон
                primaryColor: '#C8B273', // Золотой
                secondaryColor: '#A12A38', // Насыщенный красный
                borderColor: '#DAC067', // Золотой контур
                glowColor: '#F5DEB3',
                glowSize: 3,
                complexity: 6,
                theme: randomTheme
            };
        case 'rare':
            return {
                backgroundColor: '#0D1B2A', // Темно-синий фон
                primaryColor: '#D4AF37', // Насыщенный золотой
                secondaryColor: '#B22222', // Огненно-красный
                borderColor: '#E6BE8A', // Золотой контур
                glowColor: '#FFD700',
                glowSize: 4,
                complexity: 7,
                theme: randomTheme
            };
        case 'epic':
            return {
                backgroundColor: '#1A0F1C', // Темно-фиолетовый фон
                primaryColor: '#E5C687', // Роскошный светлый золотой
                secondaryColor: '#6A0DAD', // Королевский пурпурный
                borderColor: '#FFD700', // Яркий золотой контур
                glowColor: '#D4AF37',
                glowSize: 5,
                complexity: 8,
                theme: randomTheme
            };
        case 'legendary':
            return {
                backgroundColor: '#000000', // Черный фон
                primaryColor: '#FFD700', // Чистый золотой
                secondaryColor: '#B9F2FF', // Бриллиантовый голубой
                borderColor: '#E0E0E0', // Платиновый контур
                glowColor: '#FFD700', // Золотистое свечение
                glowSize: 7,
                complexity: 10,
                theme: randomTheme
            };
    }
}
/**
 * Генерирует содержимое SVG файла в роскошном реалистичном стиле
 * с элементами премиальной жизни (спорткары, яхты, особняки и т.д.)
 */
function generateSVGContent(styles) {
    const { backgroundColor, primaryColor, secondaryColor, borderColor, glowColor, glowSize, complexity, theme } = styles;
    // Создаем фильтр для свечения (шиммера)
    const glowFilter = glowSize > 0 ? `
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${glowSize}" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  ` : '';
    // Создаем фильтр для металлического/реалистичного эффекта
    const luxuryFilter = `
    <filter id="luxury">
      <feSpecularLighting result="specOut" specularExponent="20" lighting-color="#cccccc">
        <fePointLight x="100" y="100" z="200"/>
      </feSpecularLighting>
      <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
    </filter>
  `;
    // Шаблоны роскошных объектов в SVG
    const luxuryElements = {
        car: `
      <g transform="translate(100, 180) scale(1.5)">
        <!-- Премиальный спорткар в реалистичном стиле -->
        
        <!-- Кузов машины - обтекаемый спорткар -->
        <path d="M0,65 C10,60 25,55 50,55 L90,55 C115,55 130,60 140,65 L140,75 C140,78 138,80 135,80 L5,80 C2,80 0,78 0,75 Z" 
              fill="${primaryColor}" stroke="${borderColor}" stroke-width="1" filter="url(#luxury)" />
        
        <!-- Верхняя часть (крыша) с аэродинамическими линиями -->
        <path d="M40,55 C45,30 85,30 100,55" 
              fill="${primaryColor}" stroke="${borderColor}" stroke-width="1" />
        
        <!-- Дополнительные контуры для дизайна -->
        <path d="M20,65 C30,62 40,60 50,58" fill="none" stroke="${borderColor}" stroke-width="0.7" />
        <path d="M80,58 C90,60 100,62 110,65" fill="none" stroke="${borderColor}" stroke-width="0.7" />
        
        <!-- Колеса с литыми дисками -->
        <circle cx="30" cy="80" r="15" fill="#222" stroke="${borderColor}" stroke-width="1" />
        <circle cx="30" cy="80" r="9" fill="#444" />
        <circle cx="30" cy="80" r="7" fill="#666" />
        
        <!-- Детали дисков -->
        <path d="M26,74 L34,86" stroke="#999" stroke-width="1" />
        <path d="M34,74 L26,86" stroke="#999" stroke-width="1" />
        <path d="M23,80 L37,80" stroke="#999" stroke-width="1" />
        <path d="M30,73 L30,87" stroke="#999" stroke-width="1" />
        
        <!-- Заднее колесо -->
        <circle cx="110" cy="80" r="15" fill="#222" stroke="${borderColor}" stroke-width="1" />
        <circle cx="110" cy="80" r="9" fill="#444" />
        <circle cx="110" cy="80" r="7" fill="#666" />
        
        <!-- Детали заднего диска -->
        <path d="M106,74 L114,86" stroke="#999" stroke-width="1" />
        <path d="M114,74 L106,86" stroke="#999" stroke-width="1" />
        <path d="M103,80 L117,80" stroke="#999" stroke-width="1" />
        <path d="M110,73 L110,87" stroke="#999" stroke-width="1" />
        
        <!-- Тонированные окна -->
        <path d="M45,55 C50,35 80,35 95,55" 
              fill="#222" stroke="${borderColor}" stroke-width="0.7" opacity="0.8" />
        
        <!-- Детали салона, видимые сквозь стекло -->
        <path d="M50,50 L90,50" stroke="#444" stroke-width="0.5" opacity="0.5" />
        <circle cx="70" cy="45" r="3" fill="#111" /> <!-- Рулевое колесо -->
        
        <!-- Современные LED фары -->
        <path d="M10,60 L20,60 L20,65 L10,65 Z" fill="#FFFFFF" opacity="0.9" />
        <path d="M10,60 L20,60 L20,65 L10,65 Z" fill="#FFFF88" opacity="0.3" filter="url(#glow)" />
        
        <path d="M120,60 L130,60 L130,65 L120,65 Z" fill="#ff3333" opacity="0.9" /> <!-- Задние фонари -->
        <path d="M120,60 L130,60 L130,65 L120,65 Z" fill="#ff0000" opacity="0.3" filter="url(#glow)" />
        
        <!-- Детали кузова и стильные линии -->
        <path d="M40,57 C60,54 80,54 100,57" fill="none" stroke="${borderColor}" stroke-width="0.7" />
        <path d="M30,70 L110,70" fill="none" stroke="${borderColor}" stroke-width="0.5" />
        
        <!-- Воздухозаборники -->
        <path d="M60,65 L80,65 L80,70 L60,70 Z" fill="#111" />
        <path d="M62,66 L78,66" stroke="#222" stroke-width="0.5" />
        <path d="M62,67 L78,67" stroke="#222" stroke-width="0.5" />
        <path d="M62,68 L78,68" stroke="#222" stroke-width="0.5" />
        <path d="M62,69 L78,69" stroke="#222" stroke-width="0.5" />
        
        <!-- Эффект металлического блеска -->
        <path d="M30,55 C60,48 80,48 110,55" 
              fill="none" stroke="#FFF" stroke-width="1" opacity="0.2" />
        <path d="M30,52 C60,45 80,45 110,52" 
              fill="none" stroke="#FFF" stroke-width="0.5" opacity="0.1" />
        
        <!-- Логотип премиального бренда -->
        <circle cx="70" cy="62" r="4" fill="${glowColor}" stroke="${borderColor}" stroke-width="0.5" filter="url(#glow)" />
        <path d="M68,62 L72,62 M70,60 L70,64" stroke="#111" stroke-width="0.8" />
      </g>
    `,
        yacht: `
      <g transform="translate(50, 150) scale(1.2)">
        <!-- Роскошная суперяхта в реалистичном стиле -->
        
        <!-- Корпус яхты - современный дизайн -->
        <path d="M20,120 C40,115 60,110 100,110 C140,110 160,115 180,120 L200,150 L0,150 Z" 
              fill="${primaryColor}" stroke="${borderColor}" stroke-width="1" filter="url(#luxury)" />
        
        <!-- Верхние палубы - многоуровневая структура -->
        <rect x="40" y="90" width="120" height="20" rx="3" 
              fill="${secondaryColor}" stroke="${borderColor}" stroke-width="1" />
        <rect x="50" y="70" width="100" height="20" rx="3" 
              fill="${secondaryColor}" stroke="${borderColor}" stroke-width="1" />
        <rect x="60" y="50" width="80" height="20" rx="3" 
              fill="${secondaryColor}" stroke="${borderColor}" stroke-width="1" />
        
        <!-- Стеклянные панели и окна -->
        <rect x="45" y="95" width="15" height="10" rx="1" fill="#86C5DA" opacity="0.8" />
        <rect x="65" y="95" width="15" height="10" rx="1" fill="#86C5DA" opacity="0.8" />
        <rect x="85" y="95" width="15" height="10" rx="1" fill="#86C5DA" opacity="0.8" />
        <rect x="105" y="95" width="15" height="10" rx="1" fill="#86C5DA" opacity="0.8" />
        <rect x="125" y="95" width="15" height="10" rx="1" fill="#86C5DA" opacity="0.8" />
        
        <rect x="55" y="75" width="15" height="10" rx="1" fill="#86C5DA" opacity="0.8" />
        <rect x="75" y="75" width="15" height="10" rx="1" fill="#86C5DA" opacity="0.8" />
        <rect x="95" y="75" width="15" height="10" rx="1" fill="#86C5DA" opacity="0.8" />
        <rect x="115" y="75" width="15" height="10" rx="1" fill="#86C5DA" opacity="0.8" />
        
        <!-- Детали премиум-класса -->
        <circle cx="100" cy="60" r="5" fill="${glowColor}" filter="url(#glow)" /> <!-- Радар/спутниковая тарелка -->
        
        <!-- Флагшток с флагом на корме -->
        <rect x="150" y="45" width="1" height="25" fill="#555" />
        <path d="M151,45 L160,50 L151,55" fill="${borderColor}" />
        
        <!-- Перила и детали палубы -->
        <path d="M40,90 L160,90" stroke="${borderColor}" stroke-width="0.7" opacity="0.8" />
        <path d="M50,70 L150,70" stroke="${borderColor}" stroke-width="0.7" opacity="0.8" />
        <path d="M60,50 L140,50" stroke="${borderColor}" stroke-width="0.7" opacity="0.8" />
        
        <!-- Бассейн на верхней палубе -->
        <rect x="70" y="55" width="20" height="10" rx="1" fill="#86C5DA" opacity="0.6" />
        
        <!-- Спасательная шлюпка -->
        <ellipse cx="135" cy="65" rx="15" ry="5" fill="#EEE" stroke="#555" stroke-width="0.5" />
        
        <!-- Спокойная вода вокруг -->
        <path d="M-20,150 Q50,155 100,150 Q150,145 220,150 L220,180 L-20,180 Z" fill="#3A7CA5" opacity="0.6" />
        <path d="M-20,150 Q70,153 100,150 Q130,147 220,150" fill="none" stroke="#FFF" stroke-width="0.5" opacity="0.3" />
      </g>
    `,
        mansion: `
      <g transform="translate(70, 100) scale(1.2)">
        <!-- Роскошный особняк в современном стиле -->
        
        <!-- Основной корпус здания -->
        <rect x="50" y="100" width="150" height="100" rx="2" 
              fill="${primaryColor}" stroke="${borderColor}" stroke-width="1" filter="url(#luxury)" />
        
        <!-- Современная архитектурная крыша -->
        <path d="M40,100 L125,60 L210,100" fill="${secondaryColor}" stroke="${borderColor}" stroke-width="1" />
        
        <!-- Большие панорамные окна -->
        <rect x="65" y="120" width="30" height="40" rx="1" fill="#86C5DA" opacity="0.7" />
        <rect x="110" y="120" width="30" height="40" rx="1" fill="#86C5DA" opacity="0.7" />
        <rect x="155" y="120" width="30" height="40" rx="1" fill="#86C5DA" opacity="0.7" />
        
        <!-- Крыльцо и главный вход -->
        <rect x="110" y="170" width="30" height="30" rx="0" fill="${secondaryColor}" stroke="${borderColor}" stroke-width="0.7" />
        <rect x="117" y="175" width="16" height="25" fill="#3A2A1A" />
        <circle cx="128" cy="187" r="2" fill="${glowColor}" /> <!-- Дверная ручка -->
        
        <!-- Колонны у входа -->
        <rect x="105" y="170" width="5" height="30" fill="#E0E0E0" stroke="#AAA" stroke-width="0.3" />
        <rect x="140" y="170" width="5" height="30" fill="#E0E0E0" stroke="#AAA" stroke-width="0.3" />
        
        <!-- Балкон второго этажа -->
        <rect x="100" y="100" width="50" height="7" fill="#DDD" stroke="#AAA" stroke-width="0.5" />
        <path d="M100,100 L100,107 M105,100 L105,107 M110,100 L110,107 M115,100 L115,107 M120,100 L120,107 M125,100 L125,107 M130,100 L130,107 M135,100 L135,107 M140,100 L140,107 M145,100 L145,107" 
              stroke="#AAA" stroke-width="0.7" />
              
        <!-- Окна в крыше (мансарда) -->
        <rect x="85" y="80" width="20" height="15" rx="2" fill="#86C5DA" opacity="0.6" />
        <rect x="145" y="80" width="20" height="15" rx="2" fill="#86C5DA" opacity="0.6" />
        
        <!-- Ландшафтный дизайн -->
        <ellipse cx="50" cy="210" rx="30" ry="15" fill="#2E7D32" opacity="0.8" /> <!-- Кусты/газон слева -->
        <ellipse cx="200" cy="210" rx="30" ry="15" fill="#2E7D32" opacity="0.8" /> <!-- Кусты/газон справа -->
        
        <!-- Подъездная дорожка -->
        <path d="M125,200 L125,250" stroke="#AAA" stroke-width="10" opacity="0.6" />
        
        <!-- Фонтан на территории -->
        <circle cx="125" cy="250" r="15" fill="#86C5DA" opacity="0.5" />
        <circle cx="125" cy="250" r="10" fill="#86C5DA" opacity="0.7" />
        <circle cx="125" cy="250" r="2" fill="#FFF" />
        <path d="M125,245 L125,238" stroke="#FFF" stroke-width="1" />
        <path d="M125,238 C120,235 130,235 125,232" stroke="#FFF" stroke-width="1" fill="none" />
        
        <!-- Декоративное освещение -->
        <circle cx="80" cy="200" r="2" fill="#FFED88" filter="url(#glow)" />
        <circle cx="170" cy="200" r="2" fill="#FFED88" filter="url(#glow)" />
      </g>
    `,
        jet: `
      <g transform="translate(50, 150) scale(1.5)">
        <!-- Частный бизнес-джет класса люкс -->
        
        <!-- Корпус самолета - аэродинамическая форма -->
        <path d="M20,70 L140,70 C150,70 160,75 170,85 C160,95 150,100 140,100 L20,100 C15,95 10,90 10,85 C10,80 15,75 20,70Z" 
              fill="${primaryColor}" stroke="${borderColor}" stroke-width="1" filter="url(#luxury)" />
        
        <!-- Кабина и нос самолета -->
        <path d="M10,85 C5,85 0,80 5,75 C10,70 15,70 20,70" 
              fill="${primaryColor}" stroke="${borderColor}" stroke-width="1" />
        
        <!-- Хвостовое оперение -->
        <path d="M140,70 L170,40 L160,70" fill="${secondaryColor}" stroke="${borderColor}" stroke-width="0.7" />
        <path d="M140,100 L170,130 L160,100" fill="${secondaryColor}" stroke="${borderColor}" stroke-width="0.7" />
        <path d="M170,85 L190,85 L170,95" fill="${secondaryColor}" stroke="${borderColor}" stroke-width="0.7" />
        
        <!-- Крылья -->
        <path d="M70,70 L40,50 L50,70" fill="${secondaryColor}" stroke="${borderColor}" stroke-width="0.7" />
        <path d="M70,100 L40,120 L50,100" fill="${secondaryColor}" stroke="${borderColor}" stroke-width="0.7" />
        
        <!-- Двигатели на крыльях -->
        <ellipse cx="45" cy="53" rx="8" ry="3" fill="#333" stroke="#555" stroke-width="0.5" />
        <ellipse cx="45" cy="117" rx="8" ry="3" fill="#333" stroke="#555" stroke-width="0.5" />
        
        <!-- Иллюминаторы - современная овальная форма -->
        <ellipse cx="30" cy="80" rx="3" ry="4" fill="#86C5DA" opacity="0.8" />
        <ellipse cx="45" cy="80" rx="3" ry="4" fill="#86C5DA" opacity="0.8" />
        <ellipse cx="60" cy="80" rx="3" ry="4" fill="#86C5DA" opacity="0.8" />
        <ellipse cx="75" cy="80" rx="3" ry="4" fill="#86C5DA" opacity="0.8" />
        <ellipse cx="90" cy="80" rx="3" ry="4" fill="#86C5DA" opacity="0.8" />
        <ellipse cx="105" cy="80" rx="3" ry="4" fill="#86C5DA" opacity="0.8" />
        <ellipse cx="120" cy="80" rx="3" ry="4" fill="#86C5DA" opacity="0.8" />
        
        <!-- Дверь/трап -->
        <path d="M50,100 L60,120 L65,120 L55,100 Z" fill="${secondaryColor}" stroke="${borderColor}" stroke-width="0.5" />
        
        <!-- Облака для атмосферы -->
        <ellipse cx="140" cy="30" rx="25" ry="10" fill="white" opacity="0.4" />
        <ellipse cx="170" cy="20" rx="20" ry="8" fill="white" opacity="0.4" />
        <ellipse cx="120" cy="25" rx="15" ry="6" fill="white" opacity="0.4" />
        
        <!-- Отражения и блики на корпусе -->
        <path d="M30,75 Q80,70 130,75" fill="none" stroke="#FFF" stroke-width="1" opacity="0.3" />
        <path d="M30,95 Q80,100 130,95" fill="none" stroke="#FFF" stroke-width="1" opacity="0.3" />
      </g>
    `,
        character: `
      <g transform="translate(100, 100) scale(1.2)">
        <!-- Роскошный персонаж-блондин в реалистичном стиле -->
        
        <!-- Силуэт фигуры -->
        <path d="M80,140 C80,170 120,170 120,140 L115,100 L85,100 Z" 
              fill="${secondaryColor}" stroke="${borderColor}" stroke-width="1" filter="url(#luxury)" />
              
        <!-- Голова и шея -->
        <ellipse cx="100" cy="70" rx="35" ry="40" fill="#FFE0B2" stroke="#CCC" stroke-width="0.5" />
        <path d="M85,100 C90,110 110,110 115,100" fill="#FFE0B2" />
        
        <!-- Стильная блондинистая прическа -->
        <path d="M65,70 C65,40 135,40 135,70" fill="#FFD700" stroke="#E6C200" stroke-width="0.5" />
        <path d="M70,90 C60,75 60,60 65,45" fill="#FFD700" stroke="#E6C200" stroke-width="0.5" />
        <path d="M130,90 C140,75 140,60 135,45" fill="#FFD700" stroke="#E6C200" stroke-width="0.5" />
        
        <!-- Эффект шиммера на волосах -->
        <path d="M70,55 C85,45 115,45 130,55" fill="none" stroke="#FFF" stroke-width="1.5" opacity="0.5" />
        <path d="M75,65 C85,60 115,60 125,65" fill="none" stroke="#FFF" stroke-width="1" opacity="0.4" />
        <path d="M80,75 C85,70 115,70 120,75" fill="none" stroke="#FFF" stroke-width="0.5" opacity="0.3" />
        
        <!-- Лицо с чертами фотомодели -->
        <!-- Глаза - выразительные голубые -->
        <ellipse cx="85" cy="65" rx="5" ry="3" fill="white" stroke="#888" stroke-width="0.5" />
        <ellipse cx="115" cy="65" rx="5" ry="3" fill="white" stroke="#888" stroke-width="0.5" />
        
        <ellipse cx="85" cy="65" rx="3" ry="2" fill="#1E88E5" />
        <ellipse cx="115" cy="65" rx="3" ry="2" fill="#1E88E5" />
        
        <circle cx="86" cy="64" r="1" fill="white" opacity="0.8" /> <!-- Блик в глазу -->
        <circle cx="116" cy="64" r="1" fill="white" opacity="0.8" /> <!-- Блик в глазу -->
        
        <!-- Брови - ухоженные -->
        <path d="M78,57 Q85,54 92,57" fill="none" stroke="#D7A100" stroke-width="1.5" />
        <path d="M108,57 Q115,54 122,57" fill="none" stroke="#D7A100" stroke-width="1.5" />
        
        <!-- Нос - изысканный -->
        <path d="M100,65 L100,75" fill="none" stroke="#DBAC97" stroke-width="0.8" />
        <path d="M97,75 C100,77 103,77 103,75" fill="none" stroke="#DBAC97" stroke-width="0.8" />
        
        <!-- Губы - ухоженные -->
        <path d="M90,85 C100,90 110,85 110,85" fill="none" stroke="#E57373" stroke-width="1.5" />
        <path d="M90,85 C100,83 110,85 110,85" fill="none" stroke="#E57373" stroke-width="1" />
        
        <!-- Высокие скулы и контур лица -->
        <path d="M70,70 C75,90 125,90 130,70" fill="none" stroke="#DBAC97" stroke-width="0.5" opacity="0.3" />
        
        <!-- Дизайнерская одежда -->
        <!-- Пиджак/блейзер высокого класса -->
        <path d="M70,120 L85,100 L115,100 L130,120" 
              fill="${primaryColor}" stroke="#222" stroke-width="1" />
        <path d="M70,120 L70,180 L85,180 L85,140 C85,130 115,130 115,140 L115,180 L130,180 L130,120" 
              fill="${primaryColor}" stroke="#222" stroke-width="1" />
              
        <!-- Рубашка/блузка под пиджаком -->
        <path d="M85,100 L115,100 L115,140 C115,130 85,130 85,140 Z" 
              fill="white" stroke="#DDD" stroke-width="0.5" />
              
        <!-- Галстук/шарф/аксессуар на шее -->
        <path d="M95,100 L105,100 L102,130 L98,130 Z" 
              fill="${glowColor}" stroke="#222" stroke-width="0.5" />
              
        <!-- Элитные аксессуары -->
        <!-- Дизайнерские золотые наручные часы -->
        <path d="M130,130 L140,130 L140,137 L130,137 Z" 
              fill="${glowColor}" stroke="#222" stroke-width="0.5" filter="url(#glow)" />
              
        <!-- Золотая цепь с подвеской -->
        <path d="M90,110 C95,115 105,115 110,110" 
              fill="none" stroke="${glowColor}" stroke-width="2" opacity="0.8" />
        <circle cx="100" cy="115" r="5" fill="${glowColor}" stroke="#222" stroke-width="0.5" opacity="0.9" />
        <text x="100" y="118" font-family="Arial" font-size="7" font-weight="bold" text-anchor="middle" fill="#222">$</text>
        
        <!-- Солнечные очки премиум-класса -->
        <path d="M65,45 Q100,40 135,45" fill="none" stroke="#222" stroke-width="1" />
        <path d="M75,45 C75,43 85,43 85,45" fill="#222" opacity="0.7" />
        <path d="M115,45 C115,43 125,43 125,45" fill="#222" opacity="0.7" />
      </g>
    `
    };
    // Генерируем декоративные элементы в премиальном стиле
    let luxuryDecorations = '';
    for (let i = 0; i < complexity - 3; i++) {
        const decorSize = 15 + Math.random() * 30;
        const x = 20 + Math.random() * 360;
        const y = 20 + Math.random() * 360;
        // Роскошные элементы: бриллианты, золотые монеты, блики
        const decorType = Math.floor(Math.random() * 4);
        if (decorType === 0) {
            // Драгоценный камень с огранкой
            const points = [];
            const spikes = 8; // Большее количество граней для реалистичности
            const outerRadius = decorSize;
            const innerRadius = decorSize * 0.8; // Меньше разница для реалистичной огранки
            for (let j = 0; j < spikes * 2; j++) {
                const radius = j % 2 === 0 ? outerRadius : innerRadius;
                const angle = (j * Math.PI) / spikes;
                points.push(`${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`);
            }
            luxuryDecorations += `
        <g filter="url(#luxury)">
          <polygon points="${points.join(' ')}" fill="#E0F7FA" stroke="#B2EBF2" stroke-width="0.5" ${glowSize > 0 ? 'filter="url(#glow)"' : ''} opacity="0.7" />
          <polygon points="${points.join(' ')}" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.5" />
        </g>
      `;
        }
        else if (decorType === 1) {
            // Металлический блеск/свечение
            luxuryDecorations += `
        <g transform="translate(${x}, ${y}) scale(${decorSize / 40})">
          <ellipse cx="0" cy="0" rx="20" ry="5" fill="${glowColor}" opacity="0.2" filter="url(#glow)" />
          <ellipse cx="0" cy="0" rx="10" ry="2" fill="white" opacity="0.4" />
        </g>
      `;
        }
        else if (decorType === 2) {
            // Золотая/платиновая монета (символ богатства)
            luxuryDecorations += `
        <g filter="url(#luxury)">
          <circle cx="${x}" cy="${y}" r="${decorSize}" fill="${glowColor}" opacity="0.9" stroke="${borderColor}" stroke-width="0.5" />
          <circle cx="${x}" cy="${y}" r="${decorSize - 2}" fill="${glowColor}" opacity="0.8" />
          <text x="${x}" y="${y + 5}" font-family="Arial" font-size="${decorSize / 2}" font-weight="bold" text-anchor="middle" fill="#222">$</text>
        </g>
      `;
        }
        else {
            // Бриллиант с реалистичными гранями
            luxuryDecorations += `
        <g filter="url(#luxury)">
          <polygon points="${x},${y - decorSize} ${x + decorSize * 0.6},${y - decorSize * 0.3} ${x + decorSize * 0.8},${y} ${x + decorSize * 0.6},${y + decorSize * 0.3} ${x},${y + decorSize} ${x - decorSize * 0.6},${y + decorSize * 0.3} ${x - decorSize * 0.8},${y} ${x - decorSize * 0.6},${y - decorSize * 0.3}" 
                  fill="#B9F2FF" opacity="0.7" ${glowSize > 0 ? 'filter="url(#glow)"' : ''} />
          <line x1="${x - decorSize * 0.4}" y1="${y - decorSize * 0.4}" x2="${x + decorSize * 0.4}" y2="${y + decorSize * 0.4}" 
                stroke="white" opacity="0.8" stroke-width="1" />
          <line x1="${x + decorSize * 0.4}" y1="${y - decorSize * 0.4}" x2="${x - decorSize * 0.4}" y2="${y + decorSize * 0.4}" 
                stroke="white" opacity="0.8" stroke-width="1" />
        </g>
      `;
        }
    }
    // Создаем SVG
    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <defs>
        ${glowFilter}
        ${luxuryFilter}
        
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${backgroundColor}" />
          <stop offset="100%" stop-color="${secondaryColor}" />
        </linearGradient>
        
        <linearGradient id="metalgrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#333" stop-opacity="0.1" />
          <stop offset="50%" stop-color="#FFF" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#333" stop-opacity="0.1" />
        </linearGradient>
        
        <pattern id="pattern1" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1" fill="${primaryColor}" opacity="0.3" />
        </pattern>
        
        <filter id="blur">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>
      
      <!-- Фон -->
      <rect width="400" height="400" fill="url(#grad1)" />
      <rect width="400" height="400" fill="url(#pattern1)" />
      
      <!-- Декоративные элементы роскоши -->
      ${luxuryDecorations}
      
      <!-- Основной роскошный элемент в зависимости от темы -->
      ${luxuryElements[theme]}
      
      <!-- Рамка -->
      <rect width="390" height="390" x="5" y="5" stroke="${borderColor}" stroke-width="2" fill="none" rx="10" ry="10" />
      <rect width="396" height="396" x="2" y="2" stroke="${borderColor}" stroke-width="1" fill="none" rx="12" ry="12" opacity="0.5" />
      
      <!-- Премиальная надпись -->
      <text x="200" y="380" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="${glowColor}" filter="url(#blur)" opacity="0.8">Bnalbank Luxury NFT</text>
      <text x="200" y="380" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="white">Bnalbank Luxury NFT</text>
    </svg>
  `;
}
