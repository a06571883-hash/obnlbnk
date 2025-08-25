/**
 * Сервис для обеспечения согласованности NFT изображений
 * Обеспечивает, что NFT сохраняют свои оригинальные изображения при передаче между пользователями
 */

import { db } from '../db.js';
import { nfts, nftTransfers } from '../../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Проверяет и обновляет путь к изображению NFT, обеспечивая его согласованность
 * @param nftId ID NFT, изображение которого нужно проверить
 * @returns объект с результатом операции
 */
export async function ensureNftImageConsistency(nftId: number) {
  try {
    console.log(`Проверка согласованности изображения для NFT ${nftId}...`);
    
    // Получаем информацию о NFT
    const nftInfo = await db.select().from(nfts).where(eq(nfts.id, nftId));
    
    if (nftInfo.length === 0) {
      console.log(`NFT с ID ${nftId} не найден`);
      return { success: false, message: `NFT с ID ${nftId} не найден` };
    }
    
    const nft = nftInfo[0];
    
    // Если поле originalImagePath не заполнено, устанавливаем его
    if (!nft.originalImagePath) {
      console.log(`Устанавливаем originalImagePath для NFT ${nftId}`);
      await db.update(nfts)
        .set({ originalImagePath: nft.imagePath })
        .where(eq(nfts.id, nftId));
      console.log(`originalImagePath успешно установлен для NFT ${nftId}`);
      return { 
        success: true, 
        message: `originalImagePath успешно установлен для NFT ${nftId}`,
        updated: true 
      };
    }
    
    // Если imagePath отличается от originalImagePath, восстанавливаем его
    if (nft.imagePath !== nft.originalImagePath) {
      console.log(`Восстанавливаем imagePath для NFT ${nftId}`);
      await db.update(nfts)
        .set({ imagePath: nft.originalImagePath })
        .where(eq(nfts.id, nftId));
      console.log(`imagePath успешно восстановлен для NFT ${nftId}`);
      return { 
        success: true, 
        message: `imagePath успешно восстановлен для NFT ${nftId}`,
        updated: true 
      };
    }
    
    console.log(`NFT ${nftId} уже имеет согласованные пути к изображениям`);
    return { 
      success: true, 
      message: `NFT ${nftId} уже имеет согласованные пути к изображениям`,
      updated: false 
    };
  } catch (error) {
    console.error(`Ошибка при проверке согласованности изображения для NFT ${nftId}:`, error);
    return { 
      success: false, 
      message: `Ошибка при проверке согласованности изображения для NFT ${nftId}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` 
    };
  }
}

/**
 * Обновляет пути к изображениям для всех NFT, которые были куплены пользователем
 * @param userId ID пользователя, для которого нужно проверить NFT
 * @returns объект с результатом операции
 */
export async function updateUserNftImages(userId: number) {
  try {
    console.log(`Обновление путей к изображениям NFT для пользователя ${userId}...`);
    
    // Получаем все NFT пользователя
    const userNfts = await db.select().from(nfts).where(eq(nfts.ownerId, userId));
    
    if (userNfts.length === 0) {
      console.log(`У пользователя ${userId} нет NFT`);
      return { success: true, message: `У пользователя ${userId} нет NFT`, updated: 0 };
    }
    
    console.log(`Найдено ${userNfts.length} NFT у пользователя ${userId}`);
    
    // Создаем множество ID NFT
    const nftIds = new Set(userNfts.map(nft => nft.id));
    
    // Для каждого NFT проверяем историю передач
    // Если NFT был когда-либо передан, проверяем согласованность изображения
    const transferredNfts = await db.select()
      .from(nftTransfers)
      .where(eq(nftTransfers.toUserId, userId));
    
    console.log(`Найдено ${transferredNfts.length} переданных NFT для пользователя ${userId}`);
    
    let updatedCount = 0;
    
    // Обновляем только переданные NFT
    for (const transfer of transferredNfts) {
      if (nftIds.has(transfer.nftId)) {
        const result = await ensureNftImageConsistency(transfer.nftId);
        if (result.updated) {
          updatedCount++;
        }
      }
    }
    
    console.log(`Обновлено ${updatedCount} NFT у пользователя ${userId}`);
    
    return { 
      success: true, 
      message: `Обновлено ${updatedCount} NFT у пользователя ${userId}`,
      updated: updatedCount 
    };
  } catch (error) {
    console.error(`Ошибка при обновлении путей к изображениям NFT для пользователя ${userId}:`, error);
    return { 
      success: false, 
      message: `Ошибка при обновлении путей к изображениям NFT для пользователя ${userId}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` 
    };
  }
}

/**
 * Фиксирует пути к изображениям для всех NFT, которые имеют original_image_path IS NULL
 * @returns объект с результатом операции
 */
export async function fixAllNftImages() {
  try {
    console.log('Фиксация путей к изображениям для всех NFT...');
    
    // Получаем все NFT с пустым original_image_path
    const nftsToFix = await db.select()
      .from(nfts)
      .where(sql`${nfts.originalImagePath} IS NULL`);
    
    if (nftsToFix.length === 0) {
      console.log('Нет NFT с пустым original_image_path');
      return { success: true, message: 'Нет NFT с пустым original_image_path', fixed: 0 };
    }
    
    console.log(`Найдено ${nftsToFix.length} NFT с пустым original_image_path`);
    
    // Обновляем все NFT с пустым original_image_path
    for (const nft of nftsToFix) {
      await db.update(nfts)
        .set({ originalImagePath: nft.imagePath })
        .where(eq(nfts.id, nft.id));
    }
    
    console.log(`Зафиксировано ${nftsToFix.length} NFT`);
    
    return { 
      success: true, 
      message: `Зафиксировано ${nftsToFix.length} NFT`,
      fixed: nftsToFix.length 
    };
  } catch (error) {
    console.error('Ошибка при фиксации путей к изображениям для всех NFT:', error);
    return { 
      success: false, 
      message: `Ошибка при фиксации путей к изображениям для всех NFT: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` 
    };
  }
}
