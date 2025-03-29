/**
 * Контроллер для работы с NFT
 * Обрабатывает запросы API, связанные с NFT
 */
import express, { Request, Response, NextFunction } from 'express';
import * as buenoNftService from '../services/bueno-nft-service';
import * as boredApeNftService from '../services/bored-ape-nft-service';
import { storage } from '../storage';
import { z } from 'zod';
import { db } from '../db';
import { nfts, nftCollections, nftTransfers } from '../../shared/schema';
import { eq, and, not, or, inArray } from 'drizzle-orm';

const router = express.Router();

// Включаем логирование для отладки
const debug = true;
function log(...args: any[]) {
  if (debug) {
    console.log('[NFT Controller]', ...args);
  }
}

// Middleware для проверки аутентификации
function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  log('Доступ запрещен: пользователь не аутентифицирован');
  res.status(401).json({ error: 'Требуется авторизация' });
}

// Применяем middleware ко всем маршрутам контроллера
router.use(ensureAuthenticated);

// Тип редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Схема для создания NFT
const createNFTSchema = z.object({
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  price: z.number().optional().default(0)
});

// Схема для выставления NFT на продажу
const listForSaleSchema = z.object({
  nftId: z.number(),
  price: z.number().positive()
});

// Схема для покупки NFT
const buyNFTSchema = z.object({
  nftId: z.number()
});

// Схема для дарения NFT
const giftNFTSchema = z.object({
  nftId: z.number(),
  receiverUsername: z.string().min(1)
});

/**
 * Создает новый NFT
 * POST /api/nft/create
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    // Пользователь уже проверен через middleware
    const userId = req.user?.id;
    if (!userId) {
      log('ID пользователя не найден');
      return res.status(500).json({ error: 'Ошибка сервера при создании NFT' });
    }
    
    // Валидируем данные запроса
    const result = createNFTSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Некорректные данные', details: result.error.format() });
    }
    
    const { rarity, price } = result.data;
    
    // Создаем NFT из коллекции Bored Ape вместо Bueno Art
    const nft = await boredApeNftService.createBoredApeNFT(userId, rarity as NFTRarity, price);
    
    res.status(201).json({
      success: true,
      nft
    });
  } catch (error) {
    console.error('Ошибка при создании NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании NFT' });
  }
});

/**
 * Получает NFT пользователя
 * GET /api/nft/user
 */
router.get('/user', async (req: Request, res: Response) => {
  try {
    log('Запрос на получение NFT пользователя через /api/nft/user');
    
    // Пользователь уже проверен через middleware
    const userId = req.user?.id;
    if (!userId) {
      log('ID пользователя не найден');
      return res.status(500).json({ error: 'Ошибка сервера при получении NFT пользователя' });
    }
    
    log(`Получаем NFT для пользователя ${userId} (${req.user?.username})`);
    
    // Получаем NFT пользователя
    const userNFTs = await boredApeNftService.getUserNFTs(userId);
    log(`Найдено ${userNFTs.length} NFT для пользователя ${userId}`);
    
    // NFT уже в правильном формате, просто логируем и отправляем их
    log(`Отправляем ${userNFTs.length} NFT клиенту`);
    
    // Клиент ожидает прямой массив, а не объект с полем nfts
    res.status(200).json(userNFTs);
  } catch (error) {
    console.error('Ошибка при получении NFT пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении NFT пользователя' });
  }
});

/**
 * Получает список NFT на продаже
 * GET /api/nft/marketplace
 */
router.get('/marketplace', async (req: Request, res: Response) => {
  try {
    log('Запрос на получение NFT на продаже');
    
    // Пользователь уже проверен через middleware
    const userId = req.user?.id;
    if (!userId) {
      log('ID пользователя не найден');
      return res.status(500).json({ error: 'Ошибка сервера при получении NFT на продаже' });
    }
    
    log(`Получаем NFT на продаже (кроме пользователя ${userId})`);
    
    // Получаем NFT на продаже (исключая NFT текущего пользователя)
    const nftsForSale = await boredApeNftService.getNFTsForSale(userId);
    log(`Найдено ${nftsForSale.length} NFT на продаже`);
    
    // Добавляем информацию о владельцах
    const formattedNFTs = await Promise.all(nftsForSale.map(async (nft) => {
      const owner = await storage.getUser(nft.ownerId);
      return {
        ...nft,
        ownerUsername: owner ? owner.username : 'Unknown'
      };
    }));
    
    log(`Отправляем ${formattedNFTs.length} NFT клиенту`);
    
    // Клиент ожидает массив объектов, не обернутый в объект success/nfts
    res.status(200).json(formattedNFTs);
  } catch (error) {
    console.error('Ошибка при получении NFT на продаже:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении NFT на продаже' });
  }
});

/**
 * Выставляет NFT на продажу
 * POST /api/nft/list-for-sale
 */
router.post('/list-for-sale', async (req: Request, res: Response) => {
  try {
    log('Запрос на выставление NFT на продажу');
    
    // Пользователь уже проверен через middleware
    const userId = req.user?.id;
    if (!userId) {
      log('ID пользователя не найден');
      return res.status(500).json({ error: 'Ошибка сервера при выставлении NFT на продажу' });
    }
    
    // Валидируем данные запроса
    const result = listForSaleSchema.safeParse(req.body);
    
    if (!result.success) {
      log('Некорректные данные запроса');
      return res.status(400).json({ error: 'Некорректные данные', details: result.error.format() });
    }
    
    const { nftId, price } = result.data;
    log(`Выставляем NFT ${nftId} на продажу за ${price}`);
    
    // Проверяем, что пользователь является владельцем NFT
    const nftInfo = await db.select()
      .from(nfts)
      .where(eq(nfts.id, nftId));
    
    if (nftInfo.length === 0) {
      log('NFT не найден:', nftId);
      return res.status(404).json({ error: 'NFT не найден' });
    }
    
    if (nftInfo[0].ownerId !== userId) {
      log(`Пользователь ${userId} не является владельцем NFT ${nftId} (владелец: ${nftInfo[0].ownerId})`);
      return res.status(403).json({ error: 'Вы не являетесь владельцем этого NFT' });
    }
    
    // Выставляем NFT на продажу
    const updatedNft = await boredApeNftService.listNFTForSale(nftId, price);
    log('NFT успешно выставлен на продажу:', nftId);
    
    res.status(200).json({
      success: true,
      nft: updatedNft
    });
  } catch (error) {
    console.error('Ошибка при выставлении NFT на продажу:', error);
    res.status(500).json({ error: 'Ошибка сервера при выставлении NFT на продажу' });
  }
});

/**
 * Снимает NFT с продажи
 * POST /api/nft/remove-from-sale
 */
router.post('/remove-from-sale', async (req: Request, res: Response) => {
  try {
    log('Запрос на снятие NFT с продажи');
    
    // Пользователь уже проверен через middleware
    const userId = req.user?.id;
    if (!userId) {
      log('ID пользователя не найден');
      return res.status(500).json({ error: 'Ошибка сервера при снятии NFT с продажи' });
    }
    
    // Валидируем данные запроса
    const { nftId } = req.body;
    
    if (!nftId || typeof nftId !== 'number') {
      log('Некорректные данные запроса');
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    
    log(`Снимаем NFT ${nftId} с продажи пользователем ${userId}`);
    
    // Проверяем, что пользователь является владельцем NFT
    const nftInfo = await db.select()
      .from(nfts)
      .where(eq(nfts.id, nftId));
    
    if (nftInfo.length === 0) {
      log('NFT не найден:', nftId);
      return res.status(404).json({ error: 'NFT не найден' });
    }
    
    if (nftInfo[0].ownerId !== userId) {
      log(`Пользователь ${userId} не является владельцем NFT ${nftId} (владелец: ${nftInfo[0].ownerId})`);
      return res.status(403).json({ error: 'Вы не являетесь владельцем этого NFT' });
    }
    
    // Снимаем NFT с продажи
    const updatedNft = await boredApeNftService.removeNFTFromSale(nftId);
    log('NFT успешно снят с продажи:', nftId);
    
    res.status(200).json({
      success: true,
      nft: updatedNft
    });
  } catch (error) {
    console.error('Ошибка при снятии NFT с продажи:', error);
    res.status(500).json({ error: 'Ошибка сервера при снятии NFT с продажи' });
  }
});

/**
 * Покупает NFT
 * POST /api/nft/buy
 */
router.post('/buy', async (req: Request, res: Response) => {
  try {
    log('Запрос на покупку NFT');
    
    // Пользователь уже проверен через middleware
    const userId = req.user?.id;
    if (!userId) {
      log('ID пользователя не найден');
      return res.status(500).json({ error: 'Ошибка сервера при покупке NFT' });
    }
    
    // Валидируем данные запроса
    const result = buyNFTSchema.safeParse(req.body);
    
    if (!result.success) {
      log('Некорректные данные запроса');
      return res.status(400).json({ error: 'Некорректные данные', details: result.error.format() });
    }
    
    const { nftId } = result.data;
    log(`Покупаем NFT ${nftId} пользователем ${userId}`);
    
    // Покупаем NFT
    const boughtNft = await boredApeNftService.buyNFT(nftId, userId);
    log('NFT успешно куплен:', nftId);
    
    res.status(200).json({
      success: true,
      nft: boughtNft
    });
  } catch (error) {
    console.error('Ошибка при покупке NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при покупке NFT' });
  }
});

/**
 * Дарит NFT другому пользователю
 * POST /api/nft/gift
 */
router.post('/gift', async (req: Request, res: Response) => {
  try {
    log('Запрос на дарение NFT');
    
    // Пользователь уже проверен через middleware
    const userId = req.user?.id;
    if (!userId) {
      log('ID пользователя не найден');
      return res.status(500).json({ error: 'Ошибка сервера при дарении NFT' });
    }
    
    // Валидируем данные запроса
    const result = giftNFTSchema.safeParse(req.body);
    
    if (!result.success) {
      log('Некорректные данные запроса');
      return res.status(400).json({ error: 'Некорректные данные', details: result.error.format() });
    }
    
    const { nftId, receiverUsername } = result.data;
    log(`Дарим NFT ${nftId} пользователю ${receiverUsername}`);
    
    // Получаем данные получателя
    const receiver = await storage.getUserByUsername(receiverUsername);
    
    if (!receiver) {
      log(`Получатель ${receiverUsername} не найден`);
      return res.status(404).json({ error: 'Получатель не найден' });
    }
    
    // Проверяем, что пользователь является владельцем NFT
    const nftInfo = await db.select()
      .from(nfts)
      .where(eq(nfts.id, nftId));
    
    if (nftInfo.length === 0) {
      log('NFT не найден:', nftId);
      return res.status(404).json({ error: 'NFT не найден' });
    }
    
    if (nftInfo[0].ownerId !== userId) {
      log(`Пользователь ${userId} не является владельцем NFT ${nftId} (владелец: ${nftInfo[0].ownerId})`);
      return res.status(403).json({ error: 'Вы не являетесь владельцем этого NFT' });
    }
    
    // Дарим NFT
    const giftedNft = await boredApeNftService.giftNFT(nftId, userId, receiver.id);
    log(`NFT ${nftId} успешно подарен пользователю ${receiverUsername}`);
    
    res.status(200).json({
      success: true,
      nft: giftedNft
    });
  } catch (error) {
    console.error('Ошибка при дарении NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при дарении NFT' });
  }
});

/**
 * Получает историю передач NFT
 * GET /api/nft/:id/history
 */
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    log('Запрос на получение истории передач NFT:', req.params.id);
    
    // Пользователь уже проверен через middleware
    const userId = req.user?.id;
    if (!userId) {
      log('ID пользователя не найден');
      return res.status(500).json({ error: 'Ошибка сервера при получении истории передач NFT' });
    }
    
    // Получаем ID NFT
    const nftId = parseInt(req.params.id);
    
    if (isNaN(nftId)) {
      log('Некорректный ID NFT:', req.params.id);
      return res.status(400).json({ error: 'Некорректный ID NFT' });
    }
    
    log(`Получаем историю передач NFT ${nftId}`);
    
    // Получаем историю передач NFT
    const history = await boredApeNftService.getNFTTransferHistory(nftId);
    log(`Найдено ${history.length} записей истории NFT ${nftId}`);
    
    // Добавляем информацию о пользователях
    const historyWithUsernames = await Promise.all(history.map(async (transfer) => {
      const from = await storage.getUser(transfer.fromUserId);
      const to = await storage.getUser(transfer.toUserId);
      
      return {
        ...transfer,
        fromUsername: from ? from.username : 'Unknown',
        toUsername: to ? to.username : 'Unknown'
      };
    }));
    
    log(`Отправляем ${historyWithUsernames.length} записей истории NFT ${nftId}`);
    
    res.status(200).json({
      success: true,
      history: historyWithUsernames
    });
  } catch (error) {
    console.error('Ошибка при получении истории передач NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении истории передач NFT' });
  }
});

/**
 * Получает все NFT коллекции
 * GET /api/nft/collections
 */
router.get('/collections', async (req: Request, res: Response) => {
  try {
    log('Запрос на получение всех NFT коллекций');
    
    // Проверяем авторизацию
    if (!req.session.user) {
      log('Ошибка авторизации при получении коллекций');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      log('Пользователь не найден при получении коллекций');
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Получаем все коллекции
    const collections = await db.select().from(nftCollections);
    
    // Загружаем NFT для каждой коллекции
    const collectionsWithNFTs = await Promise.all(collections.map(async (collection) => {
      const collectionNFTs = await db.select().from(nfts).where(eq(nfts.collectionId, collection.id));
      return {
        ...collection,
        nfts: collectionNFTs
      };
    }));
    
    log(`Найдено ${collectionsWithNFTs.length} коллекций NFT`);
    
    res.status(200).json(collectionsWithNFTs);
  } catch (error) {
    console.error('Ошибка при получении коллекций NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении коллекций NFT' });
  }
});

/**
 * Получает информацию о доступности создания NFT в текущий день
 * GET /api/nft/daily-limit
 */
router.get('/daily-limit', async (req: Request, res: Response) => {
  try {
    log('Запрос на получение информации о лимите NFT');
    
    // Проверяем авторизацию
    if (!req.session.user) {
      log('Ошибка авторизации при проверке лимита NFT');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Лимиты для создания NFT в день
    const dailyLimit = 10;
    
    // Заглушка, в реальном проекте здесь была бы проверка количества созданных NFT за день
    const canGenerate = true;
    const message = 'Вы можете создать еще NFT сегодня';
    
    res.status(200).json({
      canGenerate,
      message
    });
  } catch (error) {
    console.error('Ошибка при получении лимита NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении лимита NFT' });
  }
});

/**
 * Обрабатывает создание NFT
 * POST /api/nft/generate
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    log('Запрос на генерацию NFT');
    
    // Проверяем авторизацию
    if (!req.session.user) {
      log('Ошибка авторизации при генерации NFT');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Валидируем данные запроса
    const { rarity } = req.body;
    
    if (!rarity || !['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(rarity)) {
      log('Некорректная редкость NFT:', rarity);
      return res.status(400).json({ error: 'Некорректная редкость NFT' });
    }
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      log('Пользователь не найден при генерации NFT');
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Создаем NFT с указанной редкостью
    const nft = await boredApeNftService.createBoredApeNFT(user.id, rarity as NFTRarity);
    
    log('NFT успешно создан:', nft.id);
    
    res.status(201).json(nft);
  } catch (error) {
    console.error('Ошибка при генерации NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при генерации NFT' });
  }
});

/**
 * Очищает все NFT пользователя
 * POST /api/nft/clear-all
 */
router.post('/clear-all', async (req: Request, res: Response) => {
  try {
    log('Запрос на очистку всех NFT');
    
    // Проверяем авторизацию
    if (!req.session.user) {
      log('Ошибка авторизации при очистке NFT');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      log('Пользователь не найден при очистке NFT');
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Получаем все NFT пользователя
    const userNFTs = await db.select().from(nfts).where(eq(nfts.ownerId, user.id));
    
    // Удаляем все NFT пользователя
    if (userNFTs.length > 0) {
      // Сначала удаляем записи о передачах NFT
      const nftIds = userNFTs.map(nft => nft.id);
      await db.delete(nftTransfers).where(
        or(
          inArray(nftTransfers.nftId, nftIds),
          and(
            eq(nftTransfers.fromUserId, user.id),
            eq(nftTransfers.toUserId, user.id)
          )
        )
      );
      
      // Затем удаляем сами NFT
      await db.delete(nfts).where(eq(nfts.ownerId, user.id));
      
      log(`Удалено ${userNFTs.length} NFT пользователя ${user.username}`);
    } else {
      log(`У пользователя ${user.username} нет NFT для удаления`);
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Все NFT успешно удалены',
      count: userNFTs.length
    });
  } catch (error) {
    console.error('Ошибка при очистке NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при очистке NFT' });
  }
});

/**
 * Получает галерею NFT пользователя
 * GET /api/nft/gallery
 */
router.get('/gallery', async (req: Request, res: Response) => {
  try {
    log('Запрос на получение галереи NFT');
    
    // Проверяем авторизацию
    if (!req.session.user) {
      log('Ошибка авторизации при получении галереи NFT');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      log('Пользователь не найден при получении галереи NFT');
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Получаем все NFT пользователя
    const userNFTs = await db.select().from(nfts).where(eq(nfts.ownerId, user.id));
    
    log(`Найдено ${userNFTs.length} NFT в галерее пользователя ${user.username}`);
    
    res.status(200).json(userNFTs);
  } catch (error) {
    console.error('Ошибка при получении галереи NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении галереи NFT' });
  }
});

/**
 * Получает детальную информацию об NFT
 * GET /api/nft/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    log('Запрос на получение детальной информации об NFT:', req.params.id);
    
    // Проверяем авторизацию
    if (!req.session.user) {
      log('Ошибка авторизации при получении информации об NFT');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем ID NFT
    const nftId = parseInt(req.params.id);
    
    if (isNaN(nftId)) {
      log('Некорректный ID NFT:', req.params.id);
      return res.status(400).json({ error: 'Некорректный ID NFT' });
    }
    
    // Получаем информацию об NFT
    const nftInfo = await db.select()
      .from(nfts)
      .where(eq(nfts.id, nftId));
    
    if (nftInfo.length === 0) {
      log('NFT не найден:', nftId);
      return res.status(404).json({ error: 'NFT не найден' });
    }
    
    // Получаем информацию о владельце
    const owner = await storage.getUser(nftInfo[0].ownerId);
    
    // Получаем информацию о коллекции
    const collectionInfo = await db.select()
      .from(nftCollections)
      .where(eq(nftCollections.id, nftInfo[0].collectionId));
    
    const collectionData = collectionInfo.length > 0 ? collectionInfo[0] : null;
    
    log('Информация об NFT получена успешно:', nftInfo[0].id);
    
    res.status(200).json({
      success: true,
      nft: {
        ...nftInfo[0],
        ownerUsername: owner ? owner.username : 'Unknown',
        collection: collectionData
      }
    });
  } catch (error) {
    console.error('Ошибка при получении информации об NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении информации об NFT' });
  }
});

export default router;