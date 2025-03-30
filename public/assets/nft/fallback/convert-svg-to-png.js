/**
 * Скрипт для конвертации SVG в PNG для браузеров, которые не поддерживают SVG
 */

document.addEventListener('DOMContentLoaded', function() {
  // Проверяем поддержку SVG
  const supportsSvg = document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1");
  
  if (!supportsSvg) {
    // Если SVG не поддерживается, заменяем все SVG на PNG
    convertSvgToPng();
  }
});

/**
 * Конвертирует SVG изображения в PNG для поддержки старых браузеров
 */
function convertSvgToPng() {
  // Массив запасных изображений для конвертации
  const svgImages = [
    '/assets/nft/fallback/common_nft.svg',
    '/assets/nft/fallback/bayc_nft.svg',
    '/assets/nft/fallback/mutant_ape_nft.svg'
  ];
  
  // Создаем скрытый канвас для конвертации
  const canvas = document.createElement('canvas');
  canvas.width = 350;
  canvas.height = 350;
  canvas.style.display = 'none';
  document.body.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  // Загружаем и конвертируем каждое SVG
  svgImages.forEach(svgPath => {
    // Создаем временный Image
    const img = new Image();
    img.onload = function() {
      // Рисуем SVG на канвасе
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Получаем PNG как Data URL
      const pngUrl = canvas.toDataURL('image/png');
      
      // Сохраняем URL для использования в getProxiedImageUrl
      localStorage.setItem(svgPath, pngUrl);
      
      // Находим все изображения с этим SVG и заменяем на PNG
      document.querySelectorAll('img[src="' + svgPath + '"]').forEach(imgEl => {
        imgEl.src = pngUrl;
      });
    };
    img.src = svgPath;
  });
  
  // Удаляем канвас после использования
  setTimeout(() => {
    document.body.removeChild(canvas);
  }, 2000);
}