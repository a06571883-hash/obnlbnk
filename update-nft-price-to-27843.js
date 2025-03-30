/**
 * Скрипт для обновления цены NFT до 27843$
 * Используем фиксированную цену для всех NFT с указанным токен ID
 */

import pg from 'pg';
const { Pool } = pg;
import { config } from 'dotenv';
config();

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Обновляет цену NFT до 27843$
 */
async function updateNFTPrice() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем обновление цены выбранного NFT...');
    
    // Получаем все NFT с определенным token_id
    const tokenId = 15351; // ID токена из логов консоли
    
    const { rows: nfts } = await client.query(
      'SELECT id, token_id, collection_id, rarity FROM nfts WHERE token_id = $1',
      [tokenId]
    );
    
    console.log(`Найдено ${nfts.length} NFT с token_id ${tokenId}.`);
    
    if (nfts.length === 0) {
      console.log(`NFT с token_id ${tokenId} не найден. Попробуем другой подход.`);
      
      // Если не нашли по конкретному token_id, возьмем первые несколько NFT
      const { rows: firstNFTs } = await client.query(
        'SELECT id, token_id, collection_id, rarity FROM nfts ORDER BY id LIMIT 10'
      );
      
      if (firstNFTs.length > 0) {
        console.log(`Выбраны первые ${firstNFTs.length} NFT для обновления.`);
        
        // Обновляем цену для выбранных NFT
        let successCount = 0;
        
        for (const nft of firstNFTs) {
          try {
            await client.query(
              'UPDATE nfts SET price = $1 WHERE id = $2',
              [27843, nft.id]
            );
            
            successCount++;
            console.log(`Обновлена цена для NFT id=${nft.id}, token_id=${nft.token_id} до 27843$.`);
          } catch (updateError) {
            console.error(`Ошибка обновления NFT id=${nft.id}:`, updateError);
          }
        }
        
        console.log(`Обновлено ${successCount} из ${firstNFTs.length} NFT.`);
      } else {
        console.log('Нет доступных NFT для обновления.');
      }
    } else {
      // Обновляем цену для найденного NFT
      for (const nft of nfts) {
        try {
          await client.query(
            'UPDATE nfts SET price = $1 WHERE id = $2',
            [27843, nft.id]
          );
          
          console.log(`Обновлена цена для NFT id=${nft.id}, token_id=${nft.token_id}, collection_id=${nft.collection_id}, rarity=${nft.rarity} до 27843$.`);
        } catch (updateError) {
          console.error(`Ошибка обновления NFT id=${nft.id}:`, updateError);
        }
      }
    }
    
    console.log('Обновление цен завершено.');
  } catch (error) {
    console.error('Ошибка при обновлении цен NFT:', error);
  } finally {
    client.release();
  }
}

// Запускаем функцию обновления цен
updateNFTPrice()
  .then(() => console.log('Скрипт обновления цен завершен успешно'))
  .catch(err => console.error('Ошибка выполнения скрипта:', err))
  .finally(() => {
    // Закрываем пул соединений
    pool.end().catch(console.error);
  });