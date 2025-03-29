/**
 * Скрипт для полного удаления всех NFT из базы данных
 * и подготовки к чистому импорту
 */

import { db } from './server/db.js';
import { nfts, nftCollections } from './shared/schema.js';

/**
 * Полностью очищает базу данных от всех NFT
 */
async function cleanAllNFT() {
  try {
    console.log("Начинаем полную очистку NFT из базы данных...");
    
    // Удаляем все NFT
    const deletedNFTs = await db.delete(nfts).returning();
    console.log(`Удалено ${deletedNFTs.length} NFT.`);
    
    // Удаляем все коллекции NFT
    const deletedCollections = await db.delete(nftCollections).returning();
    console.log(`Удалено ${deletedCollections.length} коллекций NFT.`);
    
    console.log("Очистка завершена успешно.");
    return { success: true, deletedNFTs: deletedNFTs.length, deletedCollections: deletedCollections.length };
  } catch (error) {
    console.error("Ошибка при очистке NFT:", error);
    return { success: false, error: error.message };
  }
}

// Запускаем скрипт
cleanAllNFT().then(result => {
  if (result.success) {
    console.log("Операция успешно выполнена.");
  } else {
    console.error(`Ошибка при выполнении операции: ${result.error}`);
  }
}).catch(error => {
  console.error("Непредвиденная ошибка:", error);
});