/**
 * Контроллер для работы с NFT
 * Обрабатывает запросы API, связанные с NFT
 */
import express from 'express';
import * as boredApeNftService from '../services/bored-ape-nft-service';
import { storage } from '../storage';
import { z } from 'zod';
import { db, client } from '../db';
import { nfts, nftCollections, nftTransfers, users, cards } from '../../shared/schema';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import path from 'path';
// Директории с изображениями NFT
const NFT_DIRS = {
    BORED_APE: path.join(process.cwd(), 'bored_ape_nft'),
    MUTANT_APE: path.join(process.cwd(), 'mutant_ape_nft'),
    BAYC_OFFICIAL: path.join(process.cwd(), 'bayc_official_nft')
};
const router = express.Router();
// Включаем логирование для отладки
const debug = true;
function log(...args) {
    if (debug) {
        console.log('[NFT Controller]', ...args);
    }
}
// Middleware для проверки аутентификации
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    log('Доступ запрещен: пользователь не аутентифицирован');
    res.status(401).json({ error: 'Требуется авторизация' });
}
// Схема для создания NFT
const createNFTSchema = z.object({
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    price: z.number().optional().default(0)
});
// Схема для выставления NFT на продажу (фиксированная цена $10)
const listForSaleSchema = z.object({
    nftId: z.number(),
    price: z.number().positive({ message: "Цена должна быть положительной" }).optional()
});
// Схема для покупки NFT
const buyNFTSchema = z.object({
    nftId: z.number()
});
// Схема для дарения NFT
const giftNFTSchema = z.object({
    nftId: z.number(),
    recipientUsername: z.string().min(1)
});
/**
 * Создает новый NFT
 * POST /api/nft/create
 */
router.post('/create', ensureAuthenticated, async (req, res) => {
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
        const nft = await boredApeNftService.createBoredApeNFT(userId, rarity, price);
        res.status(201).json({
            success: true,
            nft
        });
    }
    catch (error) {
        console.error('Ошибка при создании NFT:', error);
        res.status(500).json({ error: 'Ошибка сервера при создании NFT' });
    }
});
/**
 * Получает NFT пользователя
 * GET /api/nft/user
 */
router.get('/user', ensureAuthenticated, async (req, res) => {
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
        const allUserNFTs = await boredApeNftService.getUserNFTs(userId);
        log(`Найдено ${allUserNFTs.length} NFT для пользователя ${userId}`);
        // Функция для проверки, является ли NFT обезьяной BAYC
        const isBoredApe = (nft) => {
            // Проверяем, какой тип NFT
            const isNftMutant = isMutantApe(nft);
            const isNftBored = isRegularBoredApe(nft);
            // Оба типа считаются обезьянами, которые должны отображаться в маркетплейсе
            return isNftMutant || isNftBored;
        };
        // Функция для определения Mutant Ape
        const isMutantApe = (nft) => {
            // Проверка по имени NFT
            const nameCheck = nft.name?.toLowerCase().includes('mutant ape');
            // Проверка по пути к изображению
            const imageCheck = nft.imagePath?.includes('mutant_ape') ||
                nft.imageUrl?.includes('mutant_ape') ||
                nft.image_url?.includes('mutant_ape');
            return nameCheck || imageCheck;
        };
        // Функция для определения Bored Ape (не Mutant)
        const isRegularBoredApe = (nft) => {
            // Проверка по имени NFT (содержит 'Bored Ape', но не 'Mutant')
            const nameCheck = nft.name?.toLowerCase().includes('bored ape') &&
                !nft.name?.toLowerCase().includes('mutant');
            // Проверка по пути к изображению
            const imageCheck = (nft.imagePath?.includes('bored_ape') ||
                nft.imageUrl?.includes('bored_ape') ||
                nft.image_url?.includes('bored_ape') ||
                nft.imagePath?.includes('bayc_') ||
                nft.imageUrl?.includes('bayc_') ||
                nft.image_url?.includes('bayc_')) &&
                !(nft.imagePath?.includes('mutant') ||
                    nft.imageUrl?.includes('mutant') ||
                    nft.image_url?.includes('mutant'));
            return nameCheck || imageCheck;
        };
        // Фильтруем только обезьян Bored Ape
        const onlyBoredApes = allUserNFTs; // Показываем все типы NFT
        log(`Отфильтровано ${onlyBoredApes.length} обезьян BAYC из ${allUserNFTs.length} всего NFT для пользователя ${userId}`);
        log(`Отправляем ${onlyBoredApes.length} NFT клиенту`);
        // Клиент ожидает прямой массив, а не объект с полем nfts
        res.status(200).json(onlyBoredApes);
    }
    catch (error) {
        console.error('Ошибка при получении NFT пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении NFT пользователя' });
    }
});
/**
 * Получает список NFT на продаже - ПУБЛИЧНЫЙ ЭНДПОИНТ (не требует авторизации)
 * GET /api/nft/marketplace
 */
router.get('/marketplace', async (req, res) => {
    try {
        log('Запрос на получение NFT на продаже (публичный эндпоинт)');
        // Получаем ID пользователя, если он авторизован
        const userId = req.user?.id || 0; // Используем 0 если пользователь не авторизован
        log(`Получаем только обезьяны BAYC на продаже${userId ? ` (кроме пользователя ${userId})` : ''}`);
        // Массив для результатов NFT
        let combinedNFTs = [];
        // Для отслеживания уникальных токенов, чтобы избежать дубликатов
        const tokenTracker = new Set();
        // Функция для проверки, является ли NFT обезьяной BAYC
        const isBoredApe = (nft) => {
            // Проверяем, какой тип NFT
            const isNftMutant = isMutantApe(nft);
            const isNftBored = isRegularBoredApe(nft);
            // Оба типа считаются обезьянами, которые должны отображаться в маркетплейсе
            return isNftMutant || isNftBored;
        };
        // Функция для определения Mutant Ape
        const isMutantApe = (nft) => {
            // Проверка по имени NFT
            const nameCheck = nft.name?.toLowerCase().includes('mutant ape');
            // Проверка по пути к изображению
            const imageCheck = nft.imagePath?.includes('mutant_ape') ||
                nft.imageUrl?.includes('mutant_ape') ||
                nft.image_url?.includes('mutant_ape');
            return nameCheck || imageCheck;
        };
        // Функция для определения Bored Ape (не Mutant)
        const isRegularBoredApe = (nft) => {
            // Проверка по имени NFT (содержит 'Bored Ape', но не 'Mutant')
            const nameCheck = nft.name?.toLowerCase().includes('bored ape') &&
                !nft.name?.toLowerCase().includes('mutant');
            // Проверка по пути к изображению
            const imageCheck = (nft.imagePath?.includes('bored_ape') ||
                nft.imageUrl?.includes('bored_ape') ||
                nft.image_url?.includes('bored_ape') ||
                nft.imagePath?.includes('bayc_') ||
                nft.imageUrl?.includes('bayc_') ||
                nft.image_url?.includes('bayc_')) &&
                !(nft.imagePath?.includes('mutant') ||
                    nft.imageUrl?.includes('mutant') ||
                    nft.image_url?.includes('mutant'));
            return nameCheck || imageCheck;
        };
        // 1. Сначала пробуем получить NFT на продаже с помощью Drizzle ORM из таблицы nfts
        try {
            log('Получаем NFT с помощью Drizzle ORM из таблицы nfts...');
            // База запроса - NFT на продаже - показываем все NFT
            // Выбираем NFT, которые выставлены на продажу и относятся к коллекциям Bored Ape или Mutant Ape
            // Используем SQL для обработки LIKE запросов
            let query = db.select()
                .from(nfts)
                .where(and(eq(nfts.forSale, true), sql `(
            ${nfts.name} LIKE '%Bored Ape%' OR 
            ${nfts.name} LIKE '%Mutant Ape%' OR
            ${nfts.imagePath} LIKE '%bored_ape%' OR 
            ${nfts.imagePath} LIKE '%mutant_ape%' OR
            ${nfts.originalImagePath} LIKE '%bored_ape%' OR 
            ${nfts.originalImagePath} LIKE '%mutant_ape%'
          )`));
            // Показываем все NFT на продаже из обеих коллекций (BAYC и MAYC)
            // Выполняем запрос с сортировкой по случайному полю (если оно есть) или по ID
            let nftsForSaleResult;
            try {
                // Пробуем сначала сортировать по price (от низкой к высокой)
                nftsForSaleResult = await query
                    .orderBy(sql `cast(price as numeric)`) // SQL выражение для сортировки по числовому значению
                    .limit(500); // Увеличиваем лимит для получения большего числа NFT
                log('Сортировка по цене (от низкой к высокой) применена успешно');
            }
            catch (error) {
                try {
                    // Если не удалось отсортировать по цене, пробуем sort_order
                    nftsForSaleResult = await query
                        .orderBy(sql `sort_order`) // SQL выражение для поля, добавленного вручную
                        .limit(500);
                    log('Сортировка по случайному полю sort_order применена успешно');
                }
                catch (secondError) {
                    // Если и это не удалось, используем обычную сортировку по id
                    log('Не удалось применить сортировки, используем сортировку по id');
                    nftsForSaleResult = await query
                        .orderBy(nfts.id)
                        .limit(500);
                }
            }
            log(`Найдено ${nftsForSaleResult.length} NFT через Drizzle ORM из таблицы nfts`);
            if (nftsForSaleResult.length > 0) {
                // Форматируем NFT перед отправкой
                // Фильтруем дубликаты на основе tokenId
                const uniqueNFTs = nftsForSaleResult.filter(nft => {
                    // Создаем композитный ключ токена, объединяя id и коллекцию
                    const tokenKey = `${nft.tokenId}-${nft.collectionId}`;
                    // Если этот токен уже был обработан, пропускаем его
                    if (tokenTracker.has(tokenKey)) {
                        return false;
                    }
                    // Добавляем токен в трекер и включаем в результат
                    tokenTracker.add(tokenKey);
                    return true;
                });
                log(`После дедупликации осталось ${uniqueNFTs.length} уникальных NFT из ${nftsForSaleResult.length} всего`);
                const formattedNFTs = await Promise.all(uniqueNFTs.map(async (nft) => {
                    const owner = await storage.getUser(nft.ownerId);
                    // Определяем название коллекции
                    let collectionName = "Bored Ape Yacht Club"; // Дефолтное название
                    // Проверяем наличие ключевых слов в названии и пути к изображению для определения типа коллекции
                    const isMutantApe = nft.name?.toLowerCase().includes('mutant') ||
                        (nft.imagePath && nft.imagePath.includes('mutant_ape'));
                    if (isMutantApe) {
                        collectionName = "Mutant Ape Yacht Club";
                        log(`NFT #${nft.id} определен как Mutant Ape по имени: ${nft.name} или пути: ${nft.imagePath}`);
                    }
                    // Если коллекция пока не определена, проверяем по ID коллекции
                    if (nft.collectionId === 2) {
                        collectionName = "Mutant Ape Yacht Club";
                        log(`NFT #${nft.id} определен как Mutant Ape по collectionId: ${nft.collectionId}`);
                    }
                    // Пробуем получить реальное название коллекции из базы данных
                    try {
                        const collectionInfo = await db.select().from(nftCollections).where(eq(nftCollections.id, nft.collectionId)).limit(1);
                        if (collectionInfo && collectionInfo.length > 0) {
                            collectionName = collectionInfo[0].name;
                            log(`NFT #${nft.id} получил название коллекции из БД: "${collectionName}"`);
                        }
                    }
                    catch (err) {
                        console.log('Ошибка при получении названия коллекции:', err);
                    }
                    // Корректируем путь к изображению для Mutant Ape если путь указывает на Bored Ape
                    let imagePath = nft.originalImagePath || nft.imagePath;
                    if (collectionName === "Mutant Ape Yacht Club" && imagePath && imagePath.includes('bored_ape_nft')) {
                        // Заменяем путь на корректный для Mutant Ape
                        const oldPath = imagePath;
                        imagePath = imagePath.replace('/bored_ape_nft/', '/mutant_ape_nft/');
                        log(`Исправлен путь к изображению для Mutant Ape NFT #${nft.id}: ${oldPath} -> ${imagePath}`);
                    }
                    return {
                        id: nft.id,
                        tokenId: nft.tokenId,
                        collectionName: collectionName,
                        collectionId: nft.collectionId,
                        name: nft.name,
                        description: nft.description || '',
                        imagePath: imagePath,
                        imageUrl: imagePath, // Для совместимости с фронтендом
                        price: nft.price || "0",
                        forSale: nft.forSale,
                        ownerId: nft.ownerId,
                        creatorId: nft.ownerId, // В Drizzle схеме нет creatorId, используем владельца
                        ownerUsername: owner ? owner.username : 'Unknown',
                        // Добавляем базовые атрибуты для совместимости с фронтендом
                        attributes: nft.attributes || {
                            power: 70,
                            agility: 65,
                            wisdom: 60,
                            luck: 75
                        }
                    };
                }));
                // Добавляем результаты в общий массив
                combinedNFTs = [...combinedNFTs, ...formattedNFTs];
                log(`Добавлено ${formattedNFTs.length} NFT из таблицы nfts в общий результат`);
            }
        }
        catch (drizzleError) {
            console.error('Ошибка при получении NFT через Drizzle:', drizzleError);
        }
        // 2. Теперь пробуем получить NFT на продаже из таблицы nft (старая таблица)
        try {
            log('Получаем NFT из таблицы nft (legacy) с помощью прямого SQL...');
            // При использовании postgres.js, client является функцией, которую можно вызвать с шаблонным литералом
            let legacyNFTResult;
            // Показываем все NFT на продаже, независимо от пользователя
            // Убираем лимит, чтобы получить все NFT
            try {
                // Пробуем использовать сортировку по цене от низкой к высокой
                // И добавляем фильтр для выбора обезьян Bored Ape и Mutant Ape
                legacyNFTResult = await client `
          SELECT * FROM nft 
          WHERE for_sale = true 
          AND (
            name LIKE '%Bored Ape%' OR 
            name LIKE '%Mutant Ape%' OR
            image_url LIKE '%bored_ape%' OR 
            image_url LIKE '%mutant_ape%' OR
            original_image_path LIKE '%bored_ape%' OR 
            original_image_path LIKE '%mutant_ape%'
          )
          ORDER BY cast(price as numeric) ASC
          LIMIT 500
        `;
                log('Сортировка по цене (от низкой к высокой) для legacy NFT применена успешно');
            }
            catch (sortError) {
                // Если произошла ошибка, пробуем использовать сортировку по sort_order
                try {
                    legacyNFTResult = await client `
            SELECT * FROM nft 
            WHERE for_sale = true 
            AND (
              name LIKE '%Bored Ape%' OR 
              name LIKE '%Mutant Ape%' OR
              image_url LIKE '%bored_ape%' OR 
              image_url LIKE '%mutant_ape%' OR
              original_image_path LIKE '%bored_ape%' OR 
              original_image_path LIKE '%mutant_ape%'
            )
            ORDER BY sort_order
            LIMIT 500
          `;
                    log('Сортировка по случайному полю sort_order для legacy NFT применена успешно');
                }
                catch (secondSortError) {
                    // Если и sort_order не существует, используем случайную сортировку
                    legacyNFTResult = await client `
            SELECT * FROM nft 
            WHERE for_sale = true 
            AND (
              name LIKE '%Bored Ape%' OR 
              name LIKE '%Mutant Ape%' OR
              image_url LIKE '%bored_ape%' OR 
              image_url LIKE '%mutant_ape%' OR
              original_image_path LIKE '%bored_ape%' OR 
              original_image_path LIKE '%mutant_ape%'
            )
            ORDER BY RANDOM()
            LIMIT 500
          `;
                    log('Применена случайная сортировка для legacy NFT');
                }
            }
            log(`Найдено ${legacyNFTResult.length} NFT из таблицы nft (legacy)`);
            if (legacyNFTResult.length > 0) {
                // Фильтруем дубликаты из legacy таблицы
                const uniqueLegacyNFTs = legacyNFTResult.filter(nft => {
                    // Создаем композитный ключ токена для legacy NFTs
                    const legacyTokenId = nft.token_id.toString();
                    // Преобразуем в формат, совместимый с новым форматом для сравнения
                    const bayPrefix = legacyTokenId.startsWith('BAYC-') ? '' : 'BAYC-';
                    const tokenKey = `${bayPrefix}${legacyTokenId}-${nft.collection_id || '1'}`;
                    // Если этот токен уже был обработан, пропускаем его
                    if (tokenTracker.has(tokenKey)) {
                        return false;
                    }
                    // Добавляем токен в трекер и включаем в результат
                    tokenTracker.add(tokenKey);
                    return true;
                });
                log(`После дедупликации осталось ${uniqueLegacyNFTs.length} уникальных legacy NFT из ${legacyNFTResult.length} всего`);
                // Форматируем NFT перед отправкой
                const formattedLegacyNFTs = await Promise.all(uniqueLegacyNFTs.map(async (nft) => {
                    const owner = await storage.getUser(nft.owner_id);
                    // Создаем объект NFT, который будет соответствовать формату, ожидаемому фронтендом
                    return {
                        id: nft.id,
                        tokenId: nft.token_id.toString(),
                        collectionName: nft.collection_name || 'Bored Ape Yacht Club',
                        name: nft.name,
                        description: nft.description || '',
                        imagePath: nft.original_image_path || nft.image_url,
                        imageUrl: nft.original_image_path || nft.image_url, // Для совместимости с фронтендом
                        price: nft.price.toString() || "0",
                        forSale: nft.for_sale,
                        ownerId: nft.owner_id,
                        creatorId: nft.creator_id,
                        ownerUsername: owner ? owner.username : 'Unknown',
                        // Генерируем базовые атрибуты
                        attributes: {
                            power: 70,
                            agility: 65,
                            wisdom: 60,
                            luck: 75
                        },
                        // Добавляем редкость по умолчанию
                        rarity: 'common'
                    };
                }));
                // Добавляем результаты в общий массив
                combinedNFTs = [...combinedNFTs, ...formattedLegacyNFTs];
                log(`Добавлено ${formattedLegacyNFTs.length} NFT из таблицы nft (legacy) в общий результат`);
            }
        }
        catch (legacyError) {
            console.error('Ошибка при получении NFT из legacy таблицы:', legacyError);
        }
        // 3. Запасной вариант - если у нас есть авторизованный пользователь и пока нет результатов
        if (combinedNFTs.length === 0 && userId) {
            try {
                log('Первые два метода не вернули результатов, пробуем через сервис...');
                const serviceNFTs = await boredApeNftService.getNFTsForSale(userId);
                log(`Найдено ${serviceNFTs.length} NFT на продаже через сервис`);
                if (serviceNFTs.length > 0) {
                    // Фильтруем дубликаты из результатов сервиса
                    const uniqueServiceNFTs = serviceNFTs.filter(nft => {
                        // Для сервисных NFT также создаем уникальный ключ
                        const tokenIdStr = nft.tokenId?.toString() || '';
                        const collectionIdStr = nft.collectionId?.toString() || '1';
                        const tokenKey = `${tokenIdStr}-${collectionIdStr}`;
                        // Пропускаем уже обработанные токены
                        if (tokenTracker.has(tokenKey)) {
                            return false;
                        }
                        tokenTracker.add(tokenKey);
                        return true;
                    });
                    log(`После дедупликации осталось ${uniqueServiceNFTs.length} уникальных service NFT из ${serviceNFTs.length} всего`);
                    // Добавляем информацию о владельцах и названии коллекции
                    const formattedServiceNFTs = await Promise.all(uniqueServiceNFTs.map(async (nft) => {
                        const owner = await storage.getUser(nft.ownerId);
                        // Определяем название коллекции
                        let collectionName = "Bored Ape Yacht Club"; // Дефолтное название
                        // Пробуем получить реальное название коллекции из базы данных, если есть collectionId
                        if (nft.collectionId) {
                            try {
                                const collectionInfo = await db.select().from(nftCollections).where(eq(nftCollections.id, nft.collectionId)).limit(1);
                                if (collectionInfo && collectionInfo.length > 0) {
                                    collectionName = collectionInfo[0].name;
                                }
                            }
                            catch (err) {
                                console.log('Ошибка при получении названия коллекции:', err);
                            }
                        }
                        return {
                            ...nft,
                            ownerUsername: owner ? owner.username : 'Unknown',
                            collectionName: collectionName, // Добавляем название коллекции
                            // Добавляем базовые атрибуты для совместимости с фронтендом, если их нет
                            attributes: nft.attributes || {
                                power: 70,
                                agility: 65,
                                wisdom: 60,
                                luck: 75
                            }
                        };
                    }));
                    // Добавляем результаты в общий массив
                    // Преобразуем к правильному типу CombinedNFT
                    const typedServiceNFTs = formattedServiceNFTs.map(nft => ({
                        id: nft.id,
                        tokenId: nft.tokenId?.toString() || '',
                        collectionName: nft.collectionName || 'Bored Ape Yacht Club',
                        name: nft.name || '',
                        description: nft.description || '',
                        imagePath: nft.imagePath || '',
                        imageUrl: nft.imageUrl || nft.imagePath || '',
                        price: nft.price?.toString() || '0',
                        forSale: Boolean(nft.forSale),
                        ownerId: nft.ownerId,
                        creatorId: nft.creatorId || nft.ownerId,
                        ownerUsername: nft.ownerUsername || 'Unknown',
                        attributes: nft.attributes || {
                            power: 70,
                            agility: 65,
                            wisdom: 60,
                            luck: 75
                        },
                        rarity: nft.rarity || 'common'
                    }));
                    combinedNFTs = [...combinedNFTs, ...typedServiceNFTs];
                    log(`Добавлено ${formattedServiceNFTs.length} NFT из сервиса в общий результат`);
                }
            }
            catch (serviceError) {
                console.error('Ошибка при получении NFT через сервис:', serviceError);
            }
        }
        // Фильтруем только обезьян Bored Ape перед отправкой
        const onlyBoredApes = combinedNFTs; // Показываем все типы NFT
        log(`Отфильтровано ${onlyBoredApes.length} обезьян BAYC из ${combinedNFTs.length} всего NFT`);
        log(`Отправляем итоговый список из ${onlyBoredApes.length} обезьян BAYC клиенту`);
        return res.status(200).json(onlyBoredApes);
    }
    catch (error) {
        console.error('Ошибка при получении NFT на продаже:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении NFT на продаже' });
    }
});
/**
 * Выставляет NFT на продажу
 * POST /api/nft/list-for-sale
 */
router.post('/list-for-sale', ensureAuthenticated, async (req, res) => {
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
        // Цена может быть задана пользователем или использовать значение по умолчанию
        const salePrice = price ?? 10;
        log(`Выставляем NFT ${nftId} на продажу по цене $${salePrice}`);
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
        // Выставляем NFT на продажу с заданной ценой
        const updatedNft = await boredApeNftService.listNFTForSale(nftId, salePrice);
        log('NFT успешно выставлен на продажу:', nftId);
        res.status(200).json({
            success: true,
            nft: updatedNft
        });
    }
    catch (error) {
        console.error('Ошибка при выставлении NFT на продажу:', error);
        res.status(500).json({ error: 'Ошибка сервера при выставлении NFT на продажу' });
    }
});
/**
 * Снимает NFT с продажи
 * POST /api/nft/remove-from-sale
 */
router.post('/remove-from-sale', ensureAuthenticated, async (req, res) => {
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
    }
    catch (error) {
        console.error('Ошибка при снятии NFT с продажи:', error);
        res.status(500).json({ error: 'Ошибка сервера при снятии NFT с продажи' });
    }
});
/**
 * Покупает NFT
 * POST /api/nft/buy
 */
router.post('/buy', ensureAuthenticated, async (req, res) => {
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
    }
    catch (error) {
        console.error('Ошибка при покупке NFT:', error);
        res.status(500).json({ error: 'Ошибка сервера при покупке NFT' });
    }
});
/**
 * Дарит NFT другому пользователю
 * POST /api/nft/gift
 */
router.post('/gift', ensureAuthenticated, async (req, res) => {
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
        const { nftId, recipientUsername } = result.data;
        log(`Дарим NFT ${nftId} пользователю ${recipientUsername}`);
        // Получаем данные получателя
        const receiver = await storage.getUserByUsername(recipientUsername);
        if (!receiver) {
            log(`Получатель ${recipientUsername} не найден`);
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
        log(`NFT ${nftId} успешно подарен пользователю ${recipientUsername}`);
        res.status(200).json({
            success: true,
            nft: giftedNft
        });
    }
    catch (error) {
        console.error('Ошибка при дарении NFT:', error);
        res.status(500).json({ error: 'Ошибка сервера при дарении NFT' });
    }
});
/**
 * Получает историю передач NFT
 * GET /api/nft/:id/history
 */
router.get('/:id/history', ensureAuthenticated, async (req, res) => {
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
    }
    catch (error) {
        console.error('Ошибка при получении истории передач NFT:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении истории передач NFT' });
    }
});
/**
 * Получает все NFT коллекции
 * GET /api/nft/collections
 */
router.get('/collections', ensureAuthenticated, async (req, res) => {
    try {
        log('Запрос на получение всех NFT коллекций');
        // Пользователь уже проверен через middleware
        const userId = req.user?.id;
        if (!userId) {
            log('ID пользователя не найден');
            return res.status(500).json({ error: 'Ошибка сервера при получении коллекций NFT' });
        }
        log(`Получение коллекций NFT для пользователя ${userId}`);
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
    }
    catch (error) {
        console.error('Ошибка при получении коллекций NFT:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении коллекций NFT' });
    }
});
/**
 * Получает информацию о доступности создания NFT в текущий день
 * GET /api/nft/daily-limit
 */
router.get('/daily-limit', ensureAuthenticated, async (req, res) => {
    try {
        log('Запрос на получение информации о лимите NFT');
        // Пользователь уже проверен через middleware
        const userId = req.user?.id;
        if (!userId) {
            log('ID пользователя не найден');
            return res.status(500).json({ error: 'Ошибка сервера при получении лимита NFT' });
        }
        log(`Получение лимита NFT для пользователя ${userId}`);
        // Лимиты для создания NFT в день
        const dailyLimit = 10;
        // Заглушка, в реальном проекте здесь была бы проверка количества созданных NFT за день
        const canGenerate = true;
        const message = 'Вы можете создать еще NFT сегодня';
        res.status(200).json({
            canGenerate,
            message
        });
    }
    catch (error) {
        console.error('Ошибка при получении лимита NFT:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении лимита NFT' });
    }
});
/**
 * Обрабатывает создание NFT
 * POST /api/nft/generate
 */
router.post('/generate', ensureAuthenticated, async (req, res) => {
    try {
        log('Запрос на генерацию NFT');
        // Пользователь уже проверен через middleware
        const userId = req.user?.id;
        if (!userId) {
            log('ID пользователя не найден');
            return res.status(500).json({ error: 'Ошибка сервера при генерации NFT' });
        }
        // Валидируем данные запроса
        const { rarity } = req.body;
        if (!rarity || !['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(rarity)) {
            log('Некорректная редкость NFT:', rarity);
            return res.status(400).json({ error: 'Некорректная редкость NFT' });
        }
        log(`Генерация NFT с редкостью ${rarity} для пользователя ${userId}`);
        // Фиксированная стоимость создания NFT
        const NFT_CREATION_COST = 10;
        // Получаем ID администратора (регулятора)
        const adminUser = await db.select()
            .from(users)
            .where(eq(users.username, 'admin'))
            .limit(1);
        if (adminUser.length === 0) {
            return res.status(500).json({ error: 'Администратор не найден' });
        }
        const adminUserId = adminUser[0].id;
        // Получаем карту пользователя
        const userCards = await db.select()
            .from(cards)
            .where(and(eq(cards.userId, userId), eq(cards.type, 'fiat')))
            .limit(1);
        if (userCards.length === 0) {
            return res.status(400).json({ error: 'У вас нет карты для оплаты создания NFT' });
        }
        const userCard = userCards[0];
        // Получаем карту администратора
        const adminCards = await db.select()
            .from(cards)
            .where(and(eq(cards.userId, adminUserId), eq(cards.type, 'fiat')))
            .limit(1);
        if (adminCards.length === 0) {
            return res.status(500).json({ error: 'Карта администратора не найдена' });
        }
        const adminCard = adminCards[0];
        // Проверяем баланс пользователя
        if (parseFloat(userCard.balance) < NFT_CREATION_COST) {
            return res.status(400).json({
                error: `Недостаточно средств для создания NFT. Требуется: $${NFT_CREATION_COST}`
            });
        }
        // Выполняем транзакцию перевода денег от пользователя администратору
        try {
            console.log(`[NFT Controller] Начинаем перевод $${NFT_CREATION_COST} с карты ${userCard.id} на карту ${adminCard.number}`);
            console.log(`[NFT Controller] Баланс пользователя: $${userCard.balance}, ID пользователя: ${userId}`);
            console.log(`[NFT Controller] ID карты администратора: ${adminCard.id}, номер карты: ${adminCard.number}`);
            const transferResult = await storage.transferMoney(userCard.id, adminCard.number, NFT_CREATION_COST);
            if (!transferResult.success) {
                console.error(`[NFT Controller] Ошибка при переводе средств:`, transferResult);
                throw new Error(`Ошибка при переводе средств: ${transferResult.error}`);
            }
            console.log(`[NFT Controller] Перевод успешно выполнен:`, transferResult);
        }
        catch (transferError) {
            console.error(`[NFT Controller] Исключение при переводе средств:`, transferError);
            throw new Error(`Ошибка при переводе средств: ${transferError instanceof Error ? transferError.message : String(transferError)}`);
        }
        log(`Создание NFT: Оплата в размере $${NFT_CREATION_COST} переведена администратору`);
        // Создаем NFT с указанной редкостью (с ценой 0, не выставлен на продажу)
        try {
            log(`Вызов createBoredApeNFT с параметрами: userId=${userId}, rarity=${rarity}`);
            console.log(`[NFT Controller] Вызываем createBoredApeNFT - начало генерации NFT для пользователя ${userId}, редкость: ${rarity}`);
            const nft = await boredApeNftService.createBoredApeNFT(userId, rarity);
            console.log(`[NFT Controller] NFT успешно создан, результат:`, nft);
            log('NFT успешно создан:', nft.id);
            // Преобразуем путь к изображению для корректного отображения
            let imagePath = nft.imagePath || '';
            if (imagePath.startsWith('/bored_ape_nft/')) {
                console.log(`[NFT Controller] Путь к NFT изображению: ${imagePath}`);
            }
            else {
                console.log(`[NFT Controller] Внимание: получен некорректный путь к изображению: ${imagePath}`);
            }
            res.status(201).json({
                ...nft
            });
        }
        catch (nftError) {
            console.error(`[NFT Controller] Подробная ошибка при создании NFT:`, nftError);
            log('Ошибка при создании NFT в createBoredApeNFT:', nftError);
            throw new Error(`Не удалось создать NFT: ${nftError instanceof Error ? nftError.message : String(nftError)}`);
        }
    }
    catch (error) {
        console.error('Ошибка при генерации NFT:', error);
        // Детализируем ошибку в ответе для лучшей диагностики
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        res.status(500).json({
            error: `Ошибка сервера при генерации NFT: ${errorMessage}`
        });
    }
});
/**
 * Очищает все NFT пользователя
 * POST /api/nft/clear-all
 */
router.post('/clear-all', ensureAuthenticated, async (req, res) => {
    try {
        log('Запрос на очистку всех NFT');
        // Пользователь уже проверен через middleware
        const userId = req.user?.id;
        if (!userId) {
            log('ID пользователя не найден');
            return res.status(500).json({ error: 'Ошибка сервера при очистке NFT' });
        }
        log(`Очистка всех NFT для пользователя ${userId}`);
        // Получаем все NFT пользователя
        const userNFTs = await db.select().from(nfts).where(eq(nfts.ownerId, userId));
        // Удаляем все NFT пользователя
        if (userNFTs.length > 0) {
            // Сначала удаляем записи о передачах NFT
            const nftIds = userNFTs.map(nft => nft.id);
            await db.delete(nftTransfers).where(or(inArray(nftTransfers.nftId, nftIds), and(eq(nftTransfers.fromUserId, userId), eq(nftTransfers.toUserId, userId))));
            // Затем удаляем сами NFT
            await db.delete(nfts).where(eq(nfts.ownerId, userId));
            log(`Удалено ${userNFTs.length} NFT пользователя ${userId}`);
        }
        else {
            log(`У пользователя ${userId} нет NFT для удаления`);
        }
        res.status(200).json({
            success: true,
            message: 'Все NFT успешно удалены',
            count: userNFTs.length
        });
    }
    catch (error) {
        console.error('Ошибка при очистке NFT:', error);
        res.status(500).json({ error: 'Ошибка сервера при очистке NFT' });
    }
});
/**
 * Получает галерею NFT пользователя
 * GET /api/nft/gallery
 */
router.get('/gallery', ensureAuthenticated, async (req, res) => {
    try {
        log('Запрос на получение галереи NFT');
        // Пользователь уже проверен через middleware
        const userId = req.user?.id;
        if (!userId) {
            log('ID пользователя не найден');
            return res.status(500).json({ error: 'Ошибка сервера при получении галереи NFT' });
        }
        log(`Получение галереи NFT для пользователя ${userId}`);
        // Получаем все NFT пользователя
        const allUserNFTs = await db.select().from(nfts).where(eq(nfts.ownerId, userId));
        log(`Найдено ${allUserNFTs.length} NFT в галерее пользователя ${userId}`);
        // Функция для проверки, является ли NFT обезьяной BAYC
        const isBoredApe = (nft) => {
            // Проверяем, какой тип NFT
            const isNftMutant = isMutantApe(nft);
            const isNftBored = isRegularBoredApe(nft);
            // Оба типа считаются обезьянами, которые должны отображаться в маркетплейсе
            return isNftMutant || isNftBored;
        };
        // Функция для определения Mutant Ape
        const isMutantApe = (nft) => {
            // Проверка по имени NFT
            const nameCheck = nft.name?.toLowerCase().includes('mutant ape');
            // Проверка по пути к изображению
            const imageCheck = nft.imagePath?.includes('mutant_ape') ||
                nft.imageUrl?.includes('mutant_ape') ||
                nft.image_url?.includes('mutant_ape');
            return nameCheck || imageCheck;
        };
        // Функция для определения Bored Ape (не Mutant)
        const isRegularBoredApe = (nft) => {
            // Проверка по имени NFT (содержит 'Bored Ape', но не 'Mutant')
            const nameCheck = nft.name?.toLowerCase().includes('bored ape') &&
                !nft.name?.toLowerCase().includes('mutant');
            // Проверка по пути к изображению
            const imageCheck = (nft.imagePath?.includes('bored_ape') ||
                nft.imageUrl?.includes('bored_ape') ||
                nft.image_url?.includes('bored_ape') ||
                nft.imagePath?.includes('bayc_') ||
                nft.imageUrl?.includes('bayc_') ||
                nft.image_url?.includes('bayc_')) &&
                !(nft.imagePath?.includes('mutant') ||
                    nft.imageUrl?.includes('mutant') ||
                    nft.image_url?.includes('mutant'));
            return nameCheck || imageCheck;
        };
        // Фильтруем только обезьян Bored Ape
        const onlyBoredApes = allUserNFTs; // Показываем все типы NFT
        log(`Отфильтровано ${onlyBoredApes.length} обезьян BAYC из ${allUserNFTs.length} всего NFT для галереи пользователя ${userId}`);
        res.status(200).json(onlyBoredApes);
    }
    catch (error) {
        console.error('Ошибка при получении галереи NFT:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении галереи NFT' });
    }
});
/**
 * Получает детальную информацию об NFT
 * GET /api/nft/:id
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        log('Запрос на получение детальной информации об NFT:', req.params.id);
        // Пользователь уже проверен через middleware
        const userId = req.user?.id;
        if (!userId) {
            log('ID пользователя не найден');
            return res.status(500).json({ error: 'Ошибка сервера при получении информации об NFT' });
        }
        // Получаем ID NFT
        const nftId = parseInt(req.params.id);
        if (isNaN(nftId)) {
            log('Некорректный ID NFT:', req.params.id);
            return res.status(400).json({ error: 'Некорректный ID NFT' });
        }
        log(`Получение информации о NFT ${nftId} для пользователя ${userId}`);
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
    }
    catch (error) {
        console.error('Ошибка при получении информации об NFT:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении информации об NFT' });
    }
});
export default router;
