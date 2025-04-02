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

// Принудительно включаем логирование для отладки проблемы с отображением Mutant Apes
const DEBUG = true;
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
    // Показываем все NFT на продаже без жесткой фильтрации по collectionId
    // Особое детальное логирование, если включен режим DEBUG
    if (DEBUG) {
      console.log('[NFT Marketplace Controller] Запрос на получение NFT на продаже активирован');
      console.log('[NFT Marketplace Controller] Текущая фильтрация по коллекции:', collection);
    }
  
    let conditions = [
      eq(nfts.forSale, true),
      sql`(
        ${nfts.name} LIKE '%Ape%' OR
        ${nfts.imagePath} LIKE '%ape%' OR
        ${nfts.collectionId} IN (1, 2, 11)
      )`
    ];
    
    // Оторажаем условия в логах, если включен режим отладки
    if (DEBUG) {
      console.log('[NFT Marketplace Controller] Базовые условия фильтрации:');
      console.log('   - forSale = true');
      console.log('   - name содержит "Ape" ИЛИ');
      console.log('   - imagePath содержит "ape" ИЛИ');
      console.log('   - collectionId в (1, 2, 11)');
    }
    
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
        // Но не применяем фильтр по ID, чтобы показать все Mutant Ape независимо от их внутреннего ID коллекции
        // Просто фильтруем по пути к изображению и названию

        // ВАЖНО: убираем строгую проверку collectionId для большей гибкости
        // conditions.push(sql`(
        //   ${nfts.collectionId} = 2 OR 
        //   ${nfts.collectionId} = 11
        // )`);
        
        // Проверяем, что это Mutant Ape по названию или пути к изображению
        conditions.push(sql`(
          ${nfts.name} LIKE '%Mutant Ape%' OR
          ${nfts.imagePath} LIKE '%/mutant_ape%' OR
          ${nfts.imagePath} LIKE '%/nft_assets/mutant_ape/%'
        )`);
        
        // Добавляем дополнительное логирование для отладки Mutant Ape
        console.log('[NFT Marketplace Controller] Применяем расширенный фильтр для Mutant Ape Yacht Club с проверкой путей и имени');
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
    
    console.log(`[NFT Marketplace Controller] Найдено ${results.length} NFT по заданным критериям. Коллекция: ${collection || 'все'}`);
    
    if (collection === 'mutant' && VERBOSE_DEBUG) {
      // Выводим информацию о найденных Mutant Ape для отладки
      const mutantApes = results.filter(nft => 
        nft.collectionId === 2 || 
        nft.collectionId === 11 || 
        (nft.imagePath && (
          nft.imagePath.includes('/mutant_ape') || 
          nft.imagePath.includes('/nft_assets/mutant_ape/') ||
          nft.imagePath.includes('mutant')
        )) ||
        (nft.name && nft.name.toLowerCase().includes('mutant'))
      );
      
      console.log(`[NFT Marketplace Controller] В ответе найдено ${mutantApes.length} NFT Mutant Ape из ${results.length}`);
      
      // Выводим первые несколько для проверки
      if (mutantApes.length > 0) {
        const first3 = mutantApes.slice(0, 3);
        console.log('[NFT Marketplace Controller] Примеры Mutant Ape NFT:');
        first3.forEach(nft => console.log(`  - ID: ${nft.id}, Name: ${nft.name}, Path: ${nft.imagePath}, CollectionId: ${nft.collectionId}`));
      }
    }
    
    // Преобразуем результаты в единый формат
    const formattedNFTs = results.map((nft: any) => ({
      id: nft.id,
      tokenId: nft.tokenId,
      collectionName: (() => {
        // Определяем коллекцию по ID коллекции и пути к изображению
        const imagePath = nft.imagePath || '';
        const name = nft.name || '';
        
        // Проверка на Mutant Ape
        if (nft.collectionId === 2 || nft.collectionId === 11 || 
            imagePath.includes('/mutant_ape') || 
            imagePath.includes('/nft_assets/mutant_ape/') ||
            name.includes('Mutant Ape')) {
          return 'Mutant Ape Yacht Club';
        } 
        // Проверка на Bored Ape
        else if (nft.collectionId === 1 || 
                imagePath.includes('/bored_ape') || 
                name.includes('Bored Ape')) {
          return 'Bored Ape Yacht Club';
        }
        // Если не удалось определить, но в названии есть "Ape", считаем это обезьяной BAYC
        else if (name.includes('Ape')) {
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