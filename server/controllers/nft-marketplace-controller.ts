/**
 * Контроллер для расширенного NFT маркетплейса
 * Добавляет возможности пагинации, фильтрации и поиска NFT
 */

import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { nfts } from '../../shared/schema';
import { eq, and, gte, lte, like, sql, desc, asc } from 'drizzle-orm';
import { db } from '../db';

const router = Router();

// Включаем логирование, если нужно
const DEBUG = process.env.DEBUG === 'true';
function log(...args: any[]) {
  if (DEBUG) {
    console.log('[NFT Marketplace Controller]', ...args);
  }
}

/**
 * Получает список NFT на продаже с расширенными возможностями фильтрации и пагинации
 * GET /api/nft/marketplace/v2
 * 
 * Параметры запроса:
 * - page: номер страницы (начиная с 1)
 * - limit: количество элементов на странице (по умолчанию 50)
 * - sortBy: поле для сортировки (name, price, rarity)
 * - sortOrder: порядок сортировки (asc или desc)
 * - minPrice: минимальная цена для фильтрации
 * - maxPrice: максимальная цена для фильтрации
 * - rarity: фильтр по редкости (common, uncommon, rare, epic, legendary)
 * - search: поиск по имени или описанию
 * - collection: фильтр по коллекции (bored, mutant)
 */
router.get('/v2', async (req: Request, res: Response) => {
  try {
    log('Запрос на получение NFT на продаже с расширенными возможностями');
    
    // Получаем параметры запроса с значениями по умолчанию
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '50');
    const sortBy = (req.query.sortBy as string || 'price').toLowerCase();
    const sortOrder = (req.query.sortOrder as string || 'asc').toLowerCase();
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const rarity = req.query.rarity as string | undefined;
    const search = req.query.search as string | undefined;
    const collection = req.query.collection as string | undefined;
    
    // Получаем ID пользователя, если он авторизован
    const userId = req.user?.id || 0;
    
    log(`Параметры запроса: page=${page}, limit=${limit}, sortBy=${sortBy}, sortOrder=${sortOrder}`);
    if (minPrice) log(`minPrice=${minPrice}`);
    if (maxPrice) log(`maxPrice=${maxPrice}`);
    if (rarity) log(`rarity=${rarity}`);
    if (search) log(`search=${search}`);
    if (collection) log(`collection=${collection}`);
    
    // Создаем базовые условия для запроса - NFT на продаже
    let conditions = [eq(nfts.forSale, true)];
    
    // Добавляем условия фильтрации по цене
    if (minPrice !== undefined) {
      conditions.push(gte(sql`CAST(${nfts.price} AS FLOAT)`, minPrice));
    }
    
    if (maxPrice !== undefined) {
      conditions.push(lte(sql`CAST(${nfts.price} AS FLOAT)`, maxPrice));
    }
    
    // Добавляем условие фильтрации по редкости
    if (rarity) {
      conditions.push(eq(nfts.rarity, rarity));
    }
    
    // Добавляем условие поиска по имени или описанию
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        sql`(${nfts.name} ILIKE ${searchTerm} OR ${nfts.description} ILIKE ${searchTerm})`
      );
    }
    
    // Добавляем условие фильтрации по коллекции
    if (collection) {
      if (collection.toLowerCase() === 'bored') {
        conditions.push(
          sql`(${nfts.name} ILIKE '%Bored Ape%' AND ${nfts.name} NOT ILIKE '%Mutant%')`
        );
      } else if (collection.toLowerCase() === 'mutant') {
        conditions.push(
          sql`${nfts.name} ILIKE '%Mutant Ape%'`
        );
      }
    }
    
    // Считаем общее количество NFT, соответствующих фильтрам
    const countQuery = db.select({ count: sql`COUNT(*)` })
      .from(nfts)
      .where(and(...conditions));
    
    const countResult = await countQuery;
    const totalItems = parseInt(countResult[0].count.toString());
    
    // Общее количество страниц
    const totalPages = Math.ceil(totalItems / limit);
    
    // Рассчитываем смещение для пагинации
    const offset = (page - 1) * limit;
    
    // Базовый запрос
    let query = db.select().from(nfts).where(and(...conditions));
    
    // Применяем сортировку
    if (sortBy === 'price') {
      if (sortOrder === 'desc') {
        query = query.orderBy(desc(sql`CAST(${nfts.price} AS FLOAT)`));
      } else {
        query = query.orderBy(asc(sql`CAST(${nfts.price} AS FLOAT)`));
      }
    } else if (sortBy === 'name') {
      if (sortOrder === 'desc') {
        query = query.orderBy(desc(nfts.name));
      } else {
        query = query.orderBy(asc(nfts.name));
      }
    } else if (sortBy === 'rarity') {
      // Сортировка по редкости (кастомный порядок)
      const rarityOrder = sortOrder === 'asc' 
        ? "CASE rarity " +
          "WHEN 'common' THEN 1 " +
          "WHEN 'uncommon' THEN 2 " +
          "WHEN 'rare' THEN 3 " +
          "WHEN 'epic' THEN 4 " +
          "WHEN 'legendary' THEN 5 " +
          "ELSE 0 END"
        : "CASE rarity " +
          "WHEN 'legendary' THEN 1 " +
          "WHEN 'epic' THEN 2 " +
          "WHEN 'rare' THEN 3 " +
          "WHEN 'uncommon' THEN 4 " +
          "WHEN 'common' THEN 5 " +
          "ELSE 0 END";
      
      query = query.orderBy(sql`${sql.raw(rarityOrder)}`);
    }
    
    // Добавляем пагинацию
    query = query.limit(limit).offset(offset);
    
    // Выполняем запрос
    const results = await query;
    
    // Преобразуем результаты в единый формат
    const formattedNFTs = results.map((nft: any) => ({
      id: nft.id,
      tokenId: nft.tokenId,
      collectionName: nft.collectionName || '',
      name: nft.name,
      description: nft.description,
      imagePath: nft.imagePath,
      price: nft.price,
      forSale: nft.forSale,
      ownerId: nft.ownerId,
      creatorId: nft.creatorId,
      regulatorId: nft.regulatorId,
      rarity: nft.rarity,
      attributes: nft.attributes ? JSON.parse(nft.attributes as string) : null,
      mintedAt: nft.createdAt,
      owner: {
        id: nft.ownerId,
        username: nft.ownerUsername || 'Unknown'
      }
    }));
    
    // Возвращаем результат с метаданными о пагинации
    res.status(200).json({
      items: formattedNFTs,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      },
      filters: {
        sortBy,
        sortOrder,
        minPrice,
        maxPrice,
        rarity,
        search,
        collection
      }
    });
  } catch (error) {
    console.error('Ошибка при получении NFT на продаже:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении NFT на продаже' });
  }
});

export default router;