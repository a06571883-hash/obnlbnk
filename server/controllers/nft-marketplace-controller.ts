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

// Добавляем дополнительное логирование для отладки
const VERBOSE_DEBUG = true;

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
// Тестовый маршрут без аутентификации для проверки проблем с ценами
router.get('/test', async (req: Request, res: Response) => {
  try {
    // Получаем 10 NFT с ценами для анализа
    const nftItems = await db.select().from(nfts).where(eq(nfts.forSale, true)).limit(10);
    
    // Логируем и преобразуем данные для проверки цен
    const debugInfo = nftItems.map(nft => ({
      id: nft.id,
      name: nft.name,
      rawPrice: nft.price,
      parsedPrice: parseFloat(nft.price as string),
      priceType: typeof nft.price,
      isNaN: isNaN(parseFloat(nft.price as string))
    }));
    
    console.log("DEBUG NFT PRICES:", JSON.stringify(debugInfo, null, 2));
    
    res.status(200).json({
      success: true,
      message: 'Проверка цен NFT',
      data: debugInfo
    });
  } catch (error) {
    console.error('Ошибка при проверке цен NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера при тестировании NFT цен' });
  }
});

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
    // Добавляем фильтр, чтобы отображать только NFT обезьян (по collection_id)
    // Добавляем коллекцию с ID 11 - официальная коллекция Mutant Ape
    let conditions = [
      eq(nfts.forSale, true),
      sql`(
        ${nfts.collectionId} = 1 OR 
        ${nfts.collectionId} = 2 OR
        ${nfts.collectionId} = 11
      )`
    ];
    
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
    
    // Добавляем условие фильтрации по коллекции на основе collection_id
    if (collection) {
      if (collection.toLowerCase() === 'bored') {
        // Фильтруем только "Bored Ape Yacht Club" с коллекцией ID=1
        conditions.push(eq(nfts.collectionId, 1));
        // Дополнительно проверяем, что imagePath содержит /bored_ape_nft/ для точной фильтрации
        conditions.push(sql`${nfts.imagePath} LIKE '%/bored_ape_nft/%'`);
      } else if (collection.toLowerCase() === 'mutant') {
        // Фильтруем только "Mutant Ape Yacht Club" с коллекциями ID=2 и ID=11 (официальная коллекция)
        conditions.push(sql`(
          ${nfts.collectionId} = 2 OR 
          ${nfts.collectionId} = 11
        )`);
        
        // Убедимся, что путь содержит mutant_ape для точной фильтрации
        conditions.push(sql`(
          ${nfts.imagePath} LIKE '%/mutant_ape_nft/%' OR
          ${nfts.imagePath} LIKE '%/mutant_ape_official/%' OR
          ${nfts.imagePath} LIKE '%/nft_assets/mutant_ape/%'
        )`);
        
        // Добавляем дополнительное логирование для отладки Mutant Ape
        console.log('[NFT Marketplace Controller] Применяем расширенный фильтр для Mutant Ape Yacht Club с проверкой путей');
      }
    }
    
    // Считаем общее количество NFT, соответствующих фильтрам
    const countQuery = db.select({ count: sql`COUNT(*)` })
      .from(nfts)
      .where(and(...conditions));
    
    const countResult = await countQuery;
    // Используем безопасное преобразование счетчика к числу
    const countValue = countResult[0]?.count;
    const totalItems = typeof countValue === 'number' ? countValue : parseInt(String(countValue || 0));
    
    // Общее количество страниц
    const totalPages = Math.ceil(totalItems / limit);
    
    // Рассчитываем смещение для пагинации
    const offset = (page - 1) * limit;
    
    // Базовый запрос
    let query = db.select().from(nfts).where(and(...conditions));
    
    // Создаем выражение для сортировки
    let orderByExpr;
    
    // Применяем сортировку
    if (sortBy === 'price') {
      if (sortOrder === 'desc') {
        orderByExpr = desc(sql`CAST(${nfts.price} AS FLOAT)`);
      } else {
        orderByExpr = asc(sql`CAST(${nfts.price} AS FLOAT)`);
      }
    } else if (sortBy === 'name') {
      if (sortOrder === 'desc') {
        orderByExpr = desc(nfts.name);
      } else {
        orderByExpr = asc(nfts.name);
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
      
      orderByExpr = sql`${sql.raw(rarityOrder)}`;
    } else {
      // По умолчанию сортируем по ID
      orderByExpr = sortOrder === 'desc' ? desc(nfts.id) : asc(nfts.id);
    }
    
    // Формируем итоговый запрос с сортировкой и пагинацией
    const finalQuery = query
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset);
    
    // Выполняем запрос
    const results = await finalQuery;
    
    // Преобразуем результаты в единый формат
    const formattedNFTs = results.map((nft: any) => ({
      id: nft.id,
      tokenId: nft.tokenId,
      collectionName: (() => {
        // Определяем коллекцию по ID коллекции
        if (nft.collectionId === 2 || nft.collectionId === 11) {
          return 'Mutant Ape Yacht Club';
        } else if (nft.collectionId === 1) {
          return 'Bored Ape Yacht Club';
        }
        return '';
      })(),
      name: nft.name,
      description: nft.description,
      imagePath: nft.imagePath,
      price: nft.price,
      forSale: nft.forSale,
      ownerId: nft.ownerId,
      creatorId: nft.creatorId,
      regulatorId: nft.regulatorId,
      rarity: nft.rarity,
      attributes: (() => {
        try {
          if (!nft.attributes) return { power: 0, agility: 0, wisdom: 0, luck: 0 };
          if (typeof nft.attributes === 'string') {
            return JSON.parse(nft.attributes);
          }
          return nft.attributes;
        } catch (e) {
          console.error('Ошибка при парсинге атрибутов NFT:', e);
          return { power: 0, agility: 0, wisdom: 0, luck: 0 };
        }
      })(),
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