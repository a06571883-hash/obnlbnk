/**
 * Сервис для работы с NFT из коллекции Bored Ape Yacht Club
 * Обеспечивает интеграцию с загруженной из ZIP-архива коллекцией
 */
// Используем getBoredApeNFT вместо generateNFTImage
import { db } from '../db';
import { nfts, nftCollections, nftTransfers, insertNftSchema, users, cards, transactions } from '../../shared/schema';
import { eq, and, not } from 'drizzle-orm';
import { getBoredApeNFT, checkBoredApeNFTFiles } from '../utils/bored-ape-nft-loader';
import * as crypto from 'crypto';
import { storage } from '../storage';

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
 * Создает новый NFT в коллекции Bored Ape для пользователя
 * @param userId ID пользователя
 * @param rarity Редкость NFT (влияет на атрибуты и выбор изображения)
 * @param price Начальная цена NFT (может быть 0, если не для продажи)
 * @returns Полная информация о созданном NFT
 */
export async function createBoredApeNFT(userId: number, rarity: NFTRarity, price: number = 0) {
  try {
    console.log(`[Bored Ape NFT Service] Создание NFT редкости ${rarity} для пользователя ${userId}`);
    
    // Проверяем наличие файлов Bored Ape
    checkBoredApeNFTFiles();
    
    // Получаем или создаем коллекцию NFT для пользователя
    let collection = await getNFTCollectionForUser(userId);
    
    if (!collection) {
      collection = await createNFTCollectionForUser(userId);
    }
    
    // Получаем изображение NFT из коллекции Bored Ape
    const imagePath = await getBoredApeNFT(rarity);
    
    // Генерируем атрибуты NFT в зависимости от редкости
    const attributes = generateNFTAttributes(rarity);
    
    // Формируем имя и описание NFT
    const name = generateNFTName(rarity);
    const description = generateNFTDescription(rarity);
    
    // Текущая дата для поля mintedAt
    const mintedAt = new Date();
    
    // Генерируем уникальный tokenId
    const tokenId = `BAYC-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    
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
    console.error('[Bored Ape NFT Service] Ошибка при создании NFT:', error);
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
      .where(eq(nftCollections.userId, userId));
    
    if (collections.length > 0) {
      return collections[0];
    }
    
    return null;
  } catch (error) {
    console.error('[Bored Ape NFT Service] Ошибка при получении коллекции:', error);
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
    const name = `Коллекция Bored Ape Yacht Club`;
    
    // Описание коллекции
    const description = `Персональная коллекция NFT из Bored Ape Yacht Club для пользователя`;
    
    // Создаем коллекцию в базе данных
    const newCollection = await db.insert(nftCollections).values({
      userId: userId,
      name,
      description,
      createdAt: new Date()
    }).returning();
    
    return newCollection[0];
  } catch (error) {
    console.error('[Bored Ape NFT Service] Ошибка при создании коллекции:', error);
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
    common: ['Classic', 'Standard', 'Regular'],
    uncommon: ['Cool', 'Stylish', 'Trendy'],
    rare: ['Rare', 'Premium', 'Advanced'],
    epic: ['Epic', 'Superior', 'Elite'],
    legendary: ['Legendary', 'Unique', 'Ultimate']
  };
  
  // Типы NFT из коллекции Bored Ape
  const types = ['Bored Ape', 'Yacht Club Ape', 'BAYC Token', 'Crypto Ape'];
  
  // Выбираем случайные элементы
  const prefix = prefixes[rarity][Math.floor(Math.random() * prefixes[rarity].length)];
  const type = types[Math.floor(Math.random() * types.length)];
  
  // Генерируем случайный номер для уникальности
  const number = Math.floor(Math.random() * 10000);
  
  return `${prefix} ${type} #${number}`;
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
      'A standard ape from the Bored Ape Yacht Club collection.',
      'A common digital asset featuring a bored ape design.',
      'A basic token from the popular BAYC collection.'
    ],
    uncommon: [
      'An uncommon digital ape with special characteristics.',
      'A trendy Bored Ape Yacht Club token with enhanced properties.',
      'A stylish digital asset with unique ape design.'
    ],
    rare: [
      'A valuable collectible ape from the limited BAYC series.',
      'A rare digital asset with high attributes.',
      'An exclusive Bored Ape from the premium collection.'
    ],
    epic: [
      'An epic ape with exceptional properties and design.',
      'A superior BAYC token available only to a select few.',
      'An extraordinary digital asset with special value.'
    ],
    legendary: [
      'A legendary item from the ultra-rare BAYC collection.',
      'A unique digital ape with maximum attributes.',
      'The ultimate Bored Ape Yacht Club token, the pinnacle of the collection.'
    ]
  };
  
  // Выбираем случайное описание
  const descriptionText = descriptions[rarity][Math.floor(Math.random() * descriptions[rarity].length)];
  
  // Добавляем дату создания
  const currentDate = new Date();
  const dateFormatted = `${currentDate.getMonth() + 1}/${currentDate.getDate()}/${currentDate.getFullYear()}`;
  
  return `${descriptionText} Created: ${dateFormatted}`;
}

/**
 * Выставляет NFT на продажу по фиксированной цене $10
 * @param nftId ID NFT
 * @returns Обновленная информация об NFT
 */
export async function listNFTForSale(nftId: number) {
  try {
    // Фиксированная цена $10 для всех NFT
    const FIXED_NFT_PRICE = 10;
    
    console.log(`[Bored Ape NFT Service] Выставление NFT ${nftId} на продажу по фиксированной цене $${FIXED_NFT_PRICE}`);
    
    // Обновляем информацию об NFT
    const updatedNft = await db.update(nfts)
      .set({
        price: FIXED_NFT_PRICE.toString(),
        forSale: true
      })
      .where(eq(nfts.id, nftId))
      .returning();
    
    if (updatedNft.length === 0) {
      throw new Error('NFT не найден');
    }
    
    console.log(`[Bored Ape NFT Service] NFT ${nftId} успешно выставлен на продажу по цене $${FIXED_NFT_PRICE}`);
    
    return updatedNft[0];
  } catch (error) {
    console.error('[Bored Ape NFT Service] Ошибка при выставлении NFT на продажу:', error);
    throw new Error(`Не удалось выставить NFT на продажу: ${error instanceof Error ? error.message : String(error)}`);
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
    console.error('[Bored Ape NFT Service] Ошибка при снятии NFT с продажи:', error);
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
    console.log(`[Bored Ape NFT Service] Запрос на покупку NFT ${nftId} пользователем ${buyerId}`);
    
    // Фиксированная цена NFT: $10
    const FIXED_NFT_PRICE = 10;
    
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
    
    // Получаем ID администратора (регулятора)
    const adminUser = await db.select()
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);
      
    if (adminUser.length === 0) {
      throw new Error('Администратор не найден');
    }
    
    const adminUserId = adminUser[0].id;
    console.log(`[Bored Ape NFT Service] Найден администратор с ID: ${adminUserId}`);
    
    // Получаем карту покупателя
    const buyerCards = await db.select()
      .from(cards)
      .where(and(
        eq(cards.userId, buyerId),
        eq(cards.type, 'fiat')
      ))
      .limit(1);
    
    if (buyerCards.length === 0) {
      throw new Error('У вас нет карты для оплаты NFT');
    }
    
    const buyerCard = buyerCards[0];
    console.log(`[Bored Ape NFT Service] Найдена карта покупателя: ${buyerCard.id}`);
    
    // Получаем карту администратора
    const adminCards = await db.select()
      .from(cards)
      .where(and(
        eq(cards.userId, adminUserId),
        eq(cards.type, 'fiat')
      ))
      .limit(1);
    
    if (adminCards.length === 0) {
      throw new Error('Карта администратора не найдена');
    }
    
    const adminCard = adminCards[0];
    console.log(`[Bored Ape NFT Service] Найдена карта администратора: ${adminCard.id}`);
    
    // Проверяем баланс покупателя
    if (parseFloat(buyerCard.balance) < FIXED_NFT_PRICE) {
      throw new Error(`Недостаточно средств для покупки NFT. Требуется: $${FIXED_NFT_PRICE}`);
    }
    
    // Выполняем транзакцию перевода денег от покупателя администратору
    console.log(`[Bored Ape NFT Service] Выполняем перевод $${FIXED_NFT_PRICE} с карты ${buyerCard.id} на карту ${adminCard.id}`);
    const transferResult = await storage.transferMoney(
      buyerCard.id,
      adminCard.number,
      FIXED_NFT_PRICE
    );
    
    if (!transferResult.success) {
      throw new Error(`Ошибка при переводе средств: ${transferResult.error}`);
    }
    
    console.log(`[Bored Ape NFT Service] Перевод успешен, ID транзакции: ${transferResult.transaction?.id}`);
    
    // Обновляем информацию об NFT
    const updatedNft = await db.update(nfts)
      .set({
        ownerId: buyerId,
        forSale: false,
        price: '0' // Сбрасываем цену после покупки
      })
      .where(eq(nfts.id, nftId))
      .returning();
    
    // Создаем запись о передаче NFT
    await db.insert(nftTransfers).values({
      nftId: nftId,
      fromUserId: nft.ownerId,
      toUserId: buyerId,
      transferType: 'sale',
      price: FIXED_NFT_PRICE.toString(),
      transferredAt: new Date()
    });
    
    console.log(`[Bored Ape NFT Service] NFT ${nftId} успешно передан пользователю ${buyerId}`);
    
    return {
      ...updatedNft[0],
      transaction: transferResult.transaction
    };
  } catch (error) {
    console.error('[Bored Ape NFT Service] Ошибка при покупке NFT:', error);
    throw new Error(`Не удалось купить NFT: ${error instanceof Error ? error.message : String(error)}`);
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
    console.error('[Bored Ape NFT Service] Ошибка при дарении NFT:', error);
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
    console.error('[Bored Ape NFT Service] Ошибка при получении NFT пользователя:', error);
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
      query = db.select()
        .from(nfts)
        .where(and(
          eq(nfts.forSale, true),
          not(eq(nfts.ownerId, excludeUserId))
        ));
    }
    
    const nftsForSale = await query;
    
    return nftsForSale;
  } catch (error) {
    console.error('[Bored Ape NFT Service] Ошибка при получении NFT на продаже:', error);
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
    console.error('[Bored Ape NFT Service] Ошибка при получении истории передач NFT:', error);
    throw new Error(`Не удалось получить историю передач NFT: ${error}`);
  }
}