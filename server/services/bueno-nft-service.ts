/**
 * Сервис для работы с NFT из коллекции Bueno Art
 * Обеспечивает интеграцию с https://bueno.art/rhg0bfyr/ooo-bnal-bank
 */
import { generateNFTImage } from '../utils/nft-generator.js';
import { db } from '../db.js';
import { nfts, nftCollections, nftTransfers, insertNftSchema } from '../../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { getBuenoNFT } from '../utils/bueno-nft-fetcher.js';
import * as crypto from 'crypto';

// Тип редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Атрибуты NFT
interface NFTAttributes {
  power: number;
  agility: number;
  wisdom: number;
  luck: number;
}

/**
 * Создает новый NFT в коллекции Bueno Art для пользователя
 * @param userId ID пользователя
 * @param rarity Редкость NFT (влияет на атрибуты и выбор изображения)
 * @param price Начальная цена NFT (может быть 0, если не для продажи)
 * @returns Полная информация о созданном NFT
 */
export async function createBuenoNFT(userId: number, rarity: NFTRarity, price: number = 0) {
  try {
    console.log(`[Bueno NFT Service] Создание NFT редкости ${rarity} для пользователя ${userId}`);
    
    // Получаем или создаем коллекцию NFT для пользователя
    let collection = await getNFTCollectionForUser(userId);
    
    if (!collection) {
      collection = await createNFTCollectionForUser(userId);
    }
    
    // Получаем изображение NFT из коллекции Bueno Art
    const imagePath = await getBuenoNFT(rarity);
    
    // Генерируем атрибуты NFT в зависимости от редкости
    const attributes = generateNFTAttributes(rarity);
    
    // Формируем имя и описание NFT
    const name = generateNFTName(rarity);
    const description = generateNFTDescription(rarity);
    
    // Текущая дата для поля mintedAt
    const mintedAt = new Date();
    
    // Генерируем уникальный tokenId
    const tokenId = `NFT-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    
    // Создаем NFT в базе данных
    const newNft = await db.insert(nfts).values({
      collectionId: collection.id,
      ownerId: userId,
      name,
      description,
      imagePath,
      attributes,
      rarity,
      price: price.toString(), // Хранится как строка для предотвращения проблем с precision
      forSale: price > 0, // Если цена больше 0, то NFT выставлен на продажу
      mintedAt,
      tokenId
    }).returning();
    
    // Возвращаем созданный NFT
    return newNft[0];
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при создании NFT:', error);
    throw new Error(`Не удалось создать NFT: ${error}`);
  }
}

/**
 * Получает коллекцию NFT пользователя или создает новую, если не существует
 * @param userId ID пользователя
 * @returns Информация о коллекции NFT
 */
async function getNFTCollectionForUser(userId: number) {
  try {
    // Ищем существующую коллекцию для пользователя
    const collections = await db.select()
      .from(nftCollections)
      .where(eq(nftCollections.ownerId, userId));
    
    if (collections.length > 0) {
      return collections[0];
    }
    
    return null;
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при получении коллекции:', error);
    throw new Error(`Не удалось получить коллекцию NFT: ${error}`);
  }
}

/**
 * Создает новую коллекцию NFT для пользователя
 * @param userId ID пользователя
 * @returns Информация о созданной коллекции
 */
async function createNFTCollectionForUser(userId: number) {
  try {
    // Название коллекции
    const name = `Коллекция NFT Bueno Bank`;
    
    // Описание коллекции
    const description = `Персональная коллекция NFT из Bueno Art для пользователя`;
    
    // Создаем коллекцию в базе данных
    const newCollection = await db.insert(nftCollections).values({
      ownerId: userId,
      name,
      description,
      createdAt: new Date()
    }).returning();
    
    return newCollection[0];
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при создании коллекции:', error);
    throw new Error(`Не удалось создать коллекцию NFT: ${error}`);
  }
}

/**
 * Генерирует атрибуты NFT в зависимости от редкости
 * @param rarity Редкость NFT
 * @returns Атрибуты NFT
 */
function generateNFTAttributes(rarity: NFTRarity): NFTAttributes {
  // Базовые значения для каждой редкости
  const baseValues: Record<NFTRarity, number> = {
    common: 10,
    uncommon: 25,
    rare: 50,
    epic: 75,
    legendary: 90
  };
  
  // Разброс значений
  const variance: Record<NFTRarity, number> = {
    common: 20,
    uncommon: 30,
    rare: 40,
    epic: 20,
    legendary: 10
  };
  
  const baseValue = baseValues[rarity];
  const varianceValue = variance[rarity];
  
  // Создаем рандомные атрибуты с учетом базовых значений и разброса
  return {
    power: Math.min(100, Math.max(1, Math.floor(baseValue + (Math.random() * 2 - 1) * varianceValue))),
    agility: Math.min(100, Math.max(1, Math.floor(baseValue + (Math.random() * 2 - 1) * varianceValue))),
    wisdom: Math.min(100, Math.max(1, Math.floor(baseValue + (Math.random() * 2 - 1) * varianceValue))),
    luck: Math.min(100, Math.max(1, Math.floor(baseValue + (Math.random() * 2 - 1) * varianceValue)))
  };
}

/**
 * Генерирует название NFT в зависимости от редкости
 * @param rarity Редкость NFT
 * @returns Название NFT
 */
function generateNFTName(rarity: NFTRarity): string {
  // Префиксы для названий в зависимости от редкости
  const prefixes: Record<NFTRarity, string[]> = {
    common: ['Базовый', 'Стандартный', 'Обычный'],
    uncommon: ['Необычный', 'Улучшенный', 'Редкий'],
    rare: ['Редкий', 'Ценный', 'Особый'],
    epic: ['Эпический', 'Выдающийся', 'Превосходный'],
    legendary: ['Легендарный', 'Уникальный', 'Безупречный']
  };
  
  // Типы NFT
  const types = ['Виртуальный Токен', 'Цифровой Предмет', 'Коллекционный Актив'];
  
  // Выбираем случайные элементы
  const prefix = prefixes[rarity][Math.floor(Math.random() * prefixes[rarity].length)];
  const type = types[Math.floor(Math.random() * types.length)];
  
  return `${prefix} ${type} Bnalbank`;
}

/**
 * Генерирует описание NFT в зависимости от редкости
 * @param rarity Редкость NFT
 * @returns Описание NFT
 */
function generateNFTDescription(rarity: NFTRarity): string {
  // Базовые описания для каждой редкости
  const descriptions: Record<NFTRarity, string[]> = {
    common: [
      'Простой коллекционный предмет из банковской системы Bnalbank.',
      'Стандартный цифровой актив из коллекции Bnalbank.',
      'Базовый токен, доступный всем клиентам банка.'
    ],
    uncommon: [
      'Необычный цифровой токен, обладающий особыми характеристиками.',
      'Редкий предмет из коллекции Bnalbank с улучшенными свойствами.',
      'Особый цифровой актив с уникальным дизайном.'
    ],
    rare: [
      'Ценный коллекционный токен из ограниченной серии Bnalbank.',
      'Редкий цифровой актив с высокими характеристиками.',
      'Эксклюзивный предмет из премиальной коллекции банка.'
    ],
    epic: [
      'Эпический предмет с исключительными свойствами и дизайном.',
      'Превосходный токен от Bnalbank, доступный лишь избранным.',
      'Выдающийся цифровой актив, обладающий особой ценностью.'
    ],
    legendary: [
      'Легендарный предмет из ультра-редкой коллекции Bnalbank.',
      'Уникальный цифровой актив с максимальными характеристиками.',
      'Безупречный токен, являющийся вершиной коллекции.'
    ]
  };
  
  // Выбираем случайное описание
  const descriptionText = descriptions[rarity][Math.floor(Math.random() * descriptions[rarity].length)];
  
  // Добавляем дату создания
  const currentDate = new Date();
  const dateFormatted = `${currentDate.getMonth() + 1}/${currentDate.getDate()}/${currentDate.getFullYear()}`;
  
  return `${descriptionText} Дата создания: ${dateFormatted}`;
}

/**
 * Выставляет NFT на продажу или обновляет цену
 * @param nftId ID NFT
 * @param price Цена NFT
 * @returns Обновленная информация об NFT
 */
export async function listNFTForSale(nftId: number, price: number) {
  try {
    if (price <= 0) {
      throw new Error('Цена должна быть больше нуля');
    }
    
    // Обновляем информацию об NFT
    const updatedNft = await db.update(nfts)
      .set({
        price: price.toString(),
        forSale: true
      })
      .where(eq(nfts.id, nftId))
      .returning();
    
    if (updatedNft.length === 0) {
      throw new Error('NFT не найден');
    }
    
    return updatedNft[0];
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при выставлении NFT на продажу:', error);
    throw new Error(`Не удалось выставить NFT на продажу: ${error}`);
  }
}

/**
 * Снимает NFT с продажи
 * @param nftId ID NFT
 * @returns Обновленная информация об NFT
 */
export async function removeNFTFromSale(nftId: number) {
  try {
    // Обновляем информацию об NFT
    const updatedNft = await db.update(nfts)
      .set({
        forSale: false
      })
      .where(eq(nfts.id, nftId))
      .returning();
    
    if (updatedNft.length === 0) {
      throw new Error('NFT не найден');
    }
    
    return updatedNft[0];
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при снятии NFT с продажи:', error);
    throw new Error(`Не удалось снять NFT с продажи: ${error}`);
  }
}

/**
 * Покупает NFT
 * @param nftId ID NFT
 * @param buyerId ID покупателя
 * @returns Информация о купленном NFT
 */
export async function buyNFT(nftId: number, buyerId: number) {
  try {
    // Получаем информацию об NFT
    const nftInfo = await db.select()
      .from(nfts)
      .where(eq(nfts.id, nftId));
    
    if (nftInfo.length === 0) {
      throw new Error('NFT не найден');
    }
    
    const nft = nftInfo[0];
    
    // Проверяем, что NFT действительно выставлен на продажу
    if (!nft.forSale) {
      throw new Error('NFT не выставлен на продажу');
    }
    
    // Проверяем, что покупатель не является владельцем
    if (nft.ownerId === buyerId) {
      throw new Error('Вы не можете купить собственный NFT');
    }
    
    // Обновляем информацию об NFT
    const updatedNft = await db.update(nfts)
      .set({
        ownerId: buyerId,
        forSale: false
      })
      .where(eq(nfts.id, nftId))
      .returning();
    
    // Создаем запись о передаче NFT
    await db.insert(nftTransfers).values({
      nftId: nftId,
      fromUserId: nft.ownerId,
      toUserId: buyerId,
      transferType: 'sale',
      price: nft.price,
      transferredAt: new Date()
    });
    
    return updatedNft[0];
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при покупке NFT:', error);
    throw new Error(`Не удалось купить NFT: ${error}`);
  }
}

/**
 * Дарит NFT другому пользователю
 * @param nftId ID NFT
 * @param fromUserId ID текущего владельца
 * @param toUserId ID получателя
 * @returns Информация об обновленном NFT
 */
export async function giftNFT(nftId: number, fromUserId: number, toUserId: number) {
  try {
    // Проверяем, что получатель существует и отличается от отправителя
    if (fromUserId === toUserId) {
      throw new Error('Вы не можете подарить NFT самому себе');
    }
    
    // Получаем информацию об NFT
    const nftInfo = await db.select()
      .from(nfts)
      .where(and(
        eq(nfts.id, nftId),
        eq(nfts.ownerId, fromUserId)
      ));
    
    if (nftInfo.length === 0) {
      throw new Error('NFT не найден или вы не являетесь его владельцем');
    }
    
    // Обновляем информацию об NFT
    const updatedNft = await db.update(nfts)
      .set({
        ownerId: toUserId,
        forSale: false // Снимаем с продажи при передаче
      })
      .where(eq(nfts.id, nftId))
      .returning();
    
    // Создаем запись о передаче NFT
    await db.insert(nftTransfers).values({
      nftId: nftId,
      fromUserId: fromUserId,
      toUserId: toUserId,
      transferType: 'gift',
      price: '0', // При подарке цена равна 0
      transferredAt: new Date()
    });
    
    return updatedNft[0];
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при дарении NFT:', error);
    throw new Error(`Не удалось подарить NFT: ${error}`);
  }
}

/**
 * Получает список NFT пользователя
 * @param userId ID пользователя
 * @returns Список NFT пользователя
 */
export async function getUserNFTs(userId: number) {
  try {
    // Получаем все NFT пользователя
    const userNFTs = await db.select()
      .from(nfts)
      .where(eq(nfts.ownerId, userId));
    
    return userNFTs;
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при получении NFT пользователя:', error);
    throw new Error(`Не удалось получить NFT пользователя: ${error}`);
  }
}

/**
 * Получает список всех NFT, выставленных на продажу
 * @param excludeUserId ID пользователя, NFT которого следует исключить из результатов
 * @returns Список NFT, выставленных на продажу
 */
export async function getNFTsForSale(excludeUserId?: number) {
  try {
    let query = db.select()
      .from(nfts)
      .where(eq(nfts.forSale, true));
    
    // Если указан ID пользователя, исключаем его NFT из результатов
    if (excludeUserId !== undefined) {
      query = query.where(nfts.ownerId !== excludeUserId);
    }
    
    const nftsForSale = await query;
    
    return nftsForSale;
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при получении NFT на продаже:', error);
    throw new Error(`Не удалось получить NFT на продаже: ${error}`);
  }
}

/**
 * Получает историю передач NFT
 * @param nftId ID NFT
 * @returns История передач NFT
 */
export async function getNFTTransferHistory(nftId: number) {
  try {
    // Получаем историю передач NFT
    const transferHistory = await db.select()
      .from(nftTransfers)
      .where(eq(nftTransfers.nftId, nftId))
      .orderBy(nftTransfers.transferredAt);
    
    return transferHistory;
  } catch (error) {
    console.error('[Bueno NFT Service] Ошибка при получении истории передач NFT:', error);
    throw new Error(`Не удалось получить историю передач NFT: ${error}`);
  }
}
