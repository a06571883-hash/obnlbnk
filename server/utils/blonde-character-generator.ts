/**
 * Генератор пиксельных персонажей-блондинов в стиле с ретро-компьютерами
 * Основан на референсном изображении
 */

export function generateBlondeCharacter(randomGenerator: () => number, pixelSize: number, primaryColor: string, secondaryColor: string, borderColor: string): string {
  let pixels = '';
  const gridWidth = 32; // Ширина сетки в пикселях
  const gridHeight = 32; // Высота сетки в пикселях
  
  // Выбираем цвета из референса
  const backgroundColor = '#40A08E'; // Бирюзовый фон
  const shelfColor = '#E6C95C';      // Желтый цвет полок
  const chairColor = '#FF6F42';      // Оранжевый стул
  const bookColors = ['#3A7CA5', '#E6C95C', '#FF6F42', '#40A08E', '#FFEB3B']; // Разноцветные книги
  const computerColor = '#CCCCCC';   // Серый компьютер/терминал
  const screenColor = '#444444';     // Темный экран
  const blondHairColor = '#FFEB3B';  // Яркий блонд
  const skinColor = '#FFE0B2';       // Светлый тон кожи
  const shirtColor = '#2196F3';      // Синяя рубашка
  
  // Создаем фон комнаты
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${backgroundColor}" opacity="1" />`;
    }
  }
  
  // Книжная полка слева
  for (let y = 3; y < 25; y++) {
    for (let x = 1; x < 9; x++) {
      // Полки
      if (y == 8 || y == 13 || y == 18 || y == 23) {
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${shelfColor}" />`;
      }
      // Стенка полки
      else if (x == 1 || x == 8) {
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${shelfColor}" />`;
      }
      // Книги на полках
      else if (y > 8 && y < 13 || y > 13 && y < 18 || y > 18 && y < 23) {
        const bookColorIndex = Math.floor(randomGenerator() * bookColors.length);
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${bookColors[bookColorIndex]}" />`;
      }
    }
  }
  
  // Книжная полка справа
  for (let y = 3; y < 25; y++) {
    for (let x = 23; x < 31; x++) {
      // Полки
      if (y == 8 || y == 13 || y == 18 || y == 23) {
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${shelfColor}" />`;
      }
      // Стенка полки
      else if (x == 23 || x == 30) {
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${shelfColor}" />`;
      }
      // Книги на полках
      else if (y > 8 && y < 13 || y > 13 && y < 18 || y > 18 && y < 23) {
        const bookColorIndex = Math.floor(randomGenerator() * bookColors.length);
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${bookColors[bookColorIndex]}" />`;
      }
    }
  }
  
  // Проигрыватель на правой полке
  for (let y = 9; y < 12; y++) {
    for (let x = 24; x < 29; x++) {
      const isDisc = (y == 10 && x > 24 && x < 28);
      pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${isDisc ? '#3A7CA5' : '#D2B48C'}" />`;
    }
  }
  
  // Диск (пластинка)
  pixels += `<circle cx="${26 * pixelSize}" cy="${10 * pixelSize}" r="${2 * pixelSize}" fill="#3A7CA5" />`;
  pixels += `<circle cx="${26 * pixelSize}" cy="${10 * pixelSize}" r="${0.8 * pixelSize}" fill="#FFA000" />`;
  
  // Лампа вверху
  pixels += `<circle cx="${16 * pixelSize}" cy="${5 * pixelSize}" r="${4 * pixelSize}" fill="#FFFDE7" />`;
  pixels += `<circle cx="${16 * pixelSize}" cy="${5 * pixelSize}" r="${2 * pixelSize}" fill="#FF9800" />`;
  pixels += `<rect x="${15.5 * pixelSize}" y="${0}" width="${pixelSize}" height="${3 * pixelSize}" fill="#000000" />`;
  
  // Стол
  for (let x = 10; x < 22; x++) {
    pixels += `<rect x="${x * pixelSize}" y="${19 * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#8D6E63" />`;
  }
  
  // Ретро-компьютер на столе (в стиле FORTRAN)
  for (let y = 14; y < 19; y++) {
    for (let x = 11; x < 17; x++) {
      if (y == 14 && x >= 12 && x <= 15) {
        // Экран компьютера - зеленый как на старых мониторах
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#00AA00" />`;
      } else if (y > 14 && y < 18 && x >= 11 && x <= 16) {
        // Корпус компьютера
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${computerColor}" />`;
      }
    }
  }
  
  // Надпись FORTRAN на экране (пиксельными точками)
  pixels += `<rect x="${13 * pixelSize}" y="${15 * pixelSize}" width="${0.5 * pixelSize}" height="${0.5 * pixelSize}" fill="#FFFFFF" />`;
  pixels += `<rect x="${14 * pixelSize}" y="${15 * pixelSize}" width="${0.5 * pixelSize}" height="${0.5 * pixelSize}" fill="#FFFFFF" />`;
  
  // Клавиатура
  for (let y = 18; y < 19; y++) {
    for (let x = 12; x < 18; x++) {
      pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#888888" />`;
    }
  }
  
  // Стул
  for (let y = 20; y < 26; y++) {
    for (let x = 14; x < 18; x++) {
      // Сиденье стула
      if (y == 20 && x >= 14 && x < 18) {
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${chairColor}" />`;
      }
      // Спинка стула
      else if (y > 20 && y < 26 && x == 17) {
        pixels += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${chairColor}" />`;
      }
    }
  }
  
  // Блондин
  // Голова
  const headX = 14;
  const headY = 12;
  const headWidth = 5;
  const headHeight = 5;
  
  // Лицо
  for (let y = 0; y < headHeight; y++) {
    for (let x = 0; x < headWidth; x++) {
      pixels += `<rect x="${(headX + x) * pixelSize}" y="${(headY + y) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${skinColor}" />`;
    }
  }
  
  // Волосы блондина в стиле с рисунка
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < headWidth + 2; x++) {
      if ((x === 0 || x === headWidth + 1) && y > 1) continue;
      pixels += `<rect x="${(headX - 1 + x) * pixelSize}" y="${(headY - 2 + y) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${blondHairColor}" />`;
    }
  }
  
  // Причёска с волнами как на картинке
  pixels += `<rect x="${(headX - 1) * pixelSize}" y="${(headY) * pixelSize}" width="${pixelSize}" height="${2 * pixelSize}" fill="${blondHairColor}" />`;
  pixels += `<rect x="${(headX + headWidth) * pixelSize}" y="${(headY) * pixelSize}" width="${pixelSize}" height="${2 * pixelSize}" fill="${blondHairColor}" />`;
  pixels += `<rect x="${(headX + headWidth + 1) * pixelSize}" y="${(headY) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${blondHairColor}" />`;
  pixels += `<rect x="${(headX + headWidth/2) * pixelSize}" y="${(headY - 3) * pixelSize}" width="${2 * pixelSize}" height="${pixelSize}" fill="${blondHairColor}" />`;
  
  // Блики на волосах
  pixels += `<rect x="${(headX + 1) * pixelSize}" y="${(headY - 1) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#FFFFC0" />`;
  
  // Глаза - голубые как на картинке
  pixels += `<rect x="${(headX + 1) * pixelSize}" y="${(headY + 2) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#1E88E5" />`;
  pixels += `<rect x="${(headX + 3) * pixelSize}" y="${(headY + 2) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#1E88E5" />`;
  
  // Улыбка
  pixels += `<rect x="${(headX + 1) * pixelSize}" y="${(headY + 3) * pixelSize}" width="${3 * pixelSize}" height="${pixelSize}" fill="#FF6F42" />`;
  
  // Рубашка
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < headWidth + 2; x++) {
      if ((y < 1 && (x < 1 || x > headWidth)) || 
          (y >= 1 && (x < 0 || x > headWidth + 1))) continue;
      pixels += `<rect x="${(headX - 1 + x) * pixelSize}" y="${(headY + headHeight + y) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${shirtColor}" />`;
    }
  }
  
  // Книга/тетрадь/лист на столе перед персонажем
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 5; x++) {
      pixels += `<rect x="${(headX + x) * pixelSize}" y="${(headY + headHeight + 5 + y) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#FFFFFF" />`;
    }
  }
  
  // Линии в книге
  for (let y = 0; y < 2; y++) {
    pixels += `<rect x="${(headX + 1) * pixelSize}" y="${(headY + headHeight + 5 + y + 0.5) * pixelSize}" width="${3 * pixelSize}" height="${0.2 * pixelSize}" fill="#AAAAAA" />`;
  }
  
  // Ручка/карандаш
  pixels += `<rect x="${(headX + 0.5) * pixelSize}" y="${(headY + headHeight + 4.5) * pixelSize}" width="${2 * pixelSize}" height="${0.5 * pixelSize}" fill="#000000" />`;
  
  // Деньги на столе (пачка долларов) как на картинке
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 3; x++) {
      pixels += `<rect x="${(headX + 7 + x) * pixelSize}" y="${(headY + headHeight + 5 + y) * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#E0E0E0" />`;
    }
  }
  // Зеленая полоска на банкнотах
  pixels += `<rect x="${(headX + 7) * pixelSize}" y="${(headY + headHeight + 5.5) * pixelSize}" width="${3 * pixelSize}" height="${0.5 * pixelSize}" fill="#4CAF50" />`;
  
  // Добавляем эффект шиммера (блеска) на некоторых деталях
  for (let i = 0; i < 5; i++) {
    const x = (Math.floor(randomGenerator() * gridWidth)) * pixelSize;
    const y = (Math.floor(randomGenerator() * gridHeight)) * pixelSize;
    pixels += `<rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="white" opacity="0.2" />`;
  }
  
  return pixels;
}