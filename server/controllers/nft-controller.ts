/**
 * Контроллер для работы с NFT
 * Обрабатывает запросы API, связанные с NFT
 */
import express, { Request, Response } from 'express';
import * as buenoNftService from '../services/bueno-nft-service';
import { storage } from '../storage';
import { z } from 'zod';
import { db } from '../db';
import { nfts, nftCollections, nftTransfers } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

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
    // Проверяем авторизацию
    if (!req.session.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Валидируем данные запроса
    const result = createNFTSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Некорректные данные', details: result.error.format() });
    }
    
    const { rarity, price } = result.data;
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await Storage.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Создаем NFT
    const nft = await buenoNftService.createBuenoNFT(user.id, rarity as NFTRarity, price);
    
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
    // Проверяем авторизацию
    if (!req.session.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await Storage.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Получаем NFT пользователя
    const userNFTs = await buenoNftService.getUserNFTs(user.id);
    
    res.status(200).json({
      success: true,
      nfts: userNFTs
    });
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
    // Проверяем авторизацию
    if (!req.session.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await Storage.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Получаем NFT на продаже (исключая NFT текущего пользователя)
    const nftsForSale = await buenoNftService.getNFTsForSale(user.id);
    
    // Добавляем информацию о владельцах
    const nftsWithOwners = await Promise.all(nftsForSale.map(async (nft) => {
      const owner = await storage.getUserById(nft.ownerId);
      return {
        ...nft,
        ownerUsername: owner ? owner.username : 'Unknown'
      };
    }));
    
    res.status(200).json({
      success: true,
      nfts: nftsWithOwners
    });
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
    // Проверяем авторизацию
    if (!req.session.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Валидируем данные запроса
    const result = listForSaleSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Некорректные данные', details: result.error.format() });
    }
    
    const { nftId, price } = result.data;
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await Storage.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Проверяем, что пользователь является владельцем NFT
    const nftInfo = await db.select()
      .from(nfts)
      .where(eq(nfts.id, nftId));
    
    if (nftInfo.length === 0) {
      return res.status(404).json({ error: 'NFT не найден' });
    }
    
    if (nftInfo[0].ownerId !== user.id) {
      return res.status(403).json({ error: 'Вы не являетесь владельцем этого NFT' });
    }
    
    // Выставляем NFT на продажу
    const updatedNft = await buenoNftService.listNFTForSale(nftId, price);
    
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
    // Проверяем авторизацию
    if (!req.session.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Валидируем данные запроса
    const { nftId } = req.body;
    
    if (!nftId || typeof nftId !== 'number') {
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await Storage.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Проверяем, что пользователь является владельцем NFT
    const nftInfo = await db.select()
      .from(nfts)
      .where(eq(nfts.id, nftId));
    
    if (nftInfo.length === 0) {
      return res.status(404).json({ error: 'NFT не найден' });
    }
    
    if (nftInfo[0].ownerId !== user.id) {
      return res.status(403).json({ error: 'Вы не являетесь владельцем этого NFT' });
    }
    
    // Снимаем NFT с продажи
    const updatedNft = await buenoNftService.removeNFTFromSale(nftId);
    
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
    // Проверяем авторизацию
    if (!req.session.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Валидируем данные запроса
    const result = buyNFTSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Некорректные данные', details: result.error.format() });
    }
    
    const { nftId } = result.data;
    
    // Получаем ID пользователя
    const username = req.session.user;
    const user = await Storage.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Покупаем NFT
    const boughtNft = await buenoNftService.buyNFT(nftId, user.id);
    
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
    // Проверяем авторизацию
    if (!req.session.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Валидируем данные запроса
    const result = giftNFTSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Некорректные данные', details: result.error.format() });
    }
    
    const { nftId, receiverUsername } = result.data;
    
    // Получаем данные отправителя
    const senderUsername = req.session.user;
    const sender = await storage.getUserByUsername(senderUsername);
    
    if (!sender) {
      return res.status(404).json({ error: 'Отправитель не найден' });
    }
    
    // Получаем данные получателя
    const receiver = await storage.getUserByUsername(receiverUsername);
    
    if (!receiver) {
      return res.status(404).json({ error: 'Получатель не найден' });
    }
    
    // Дарим NFT
    const giftedNft = await buenoNftService.giftNFT(nftId, sender.id, receiver.id);
    
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
    // Проверяем авторизацию
    if (!req.session.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем ID NFT
    const nftId = parseInt(req.params.id);
    
    if (isNaN(nftId)) {
      return res.status(400).json({ error: 'Некорректный ID NFT' });
    }
    
    // Получаем историю передач NFT
    const history = await buenoNftService.getNFTTransferHistory(nftId);
    
    // Добавляем информацию о пользователях
    const historyWithUsernames = await Promise.all(history.map(async (transfer) => {
      const from = await storage.getUserById(transfer.fromUserId);
      const to = await storage.getUserById(transfer.toUserId);
      
      return {
        ...transfer,
        fromUsername: from ? from.username : 'Unknown',
        toUsername: to ? to.username : 'Unknown'
      };
    }));
    
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
 * Получает детальную информацию об NFT
 * GET /api/nft/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Проверяем авторизацию
    if (!req.session.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем ID NFT
    const nftId = parseInt(req.params.id);
    
    if (isNaN(nftId)) {
      return res.status(400).json({ error: 'Некорректный ID NFT' });
    }
    
    // Получаем информацию об NFT
    const nftInfo = await db.select()
      .from(nfts)
      .where(eq(nfts.id, nftId));
    
    if (nftInfo.length === 0) {
      return res.status(404).json({ error: 'NFT не найден' });
    }
    
    // Получаем информацию о владельце
    const owner = await storage.getUserById(nftInfo[0].ownerId);
    
    // Получаем информацию о коллекции
    const collectionInfo = await db.select()
      .from(nftCollections)
      .where(eq(nftCollections.id, nftInfo[0].collectionId));
    
    const collectionData = collectionInfo.length > 0 ? collectionInfo[0] : null;
    
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