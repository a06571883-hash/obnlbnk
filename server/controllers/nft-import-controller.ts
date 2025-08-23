/**
 * Контроллер для импорта NFT из коллекции Bored Ape в маркетплейс
 */
import express, { Request, Response, NextFunction } from 'express';
import { importBoredApesToMarketplace, countBoredApeImages } from '../utils/import-bored-apes-to-marketplace.js';

const router = express.Router();

// Включаем логирование для отладки
const debug = true;
function log(...args: any[]) {
  if (debug) {
    console.log('[NFT Import Controller]', ...args);
  }
}

// Middleware для проверки, что пользователь является регулятором (администратором)
function ensureAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user?.is_regulator) {
    return next();
  }
  log('Доступ запрещен: пользователь не является администратором (регулятором)');
  res.status(403).json({ error: 'Для доступа требуются права администратора' });
}

// Применяем middleware ко всем маршрутам контроллера
router.use(ensureAdmin);

/**
 * Получает информацию о количестве изображений для импорта
 * GET /api/nft-import/info
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    log('Запрос информации о доступных изображениях Bored Ape');
    
    const imageInfo = await countBoredApeImages();
    
    res.status(200).json({
      success: true,
      data: imageInfo
    });
  } catch (error) {
    console.error('Ошибка при получении информации о доступных изображениях:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении информации' });
  }
});

/**
 * Запускает импорт NFT из коллекции Bored Ape в маркетплейс
 * POST /api/nft-import/start
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    log('Запрос на запуск импорта NFT');
    
    // Запускаем импорт
    const result = await importBoredApesToMarketplace();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Не удалось выполнить импорт NFT'
      });
    }
  } catch (error) {
    console.error('Ошибка при запуске импорта NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при импорте NFT' });
  }
});

export default router;