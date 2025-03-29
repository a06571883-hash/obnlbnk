/**
 * Получает список NFT на продаже
 * GET /api/nft/marketplace
 */
router.get('/marketplace', async (req: Request, res: Response) => {
  try {
    log('Запрос на получение NFT на продаже');
    
    // Пользователь уже проверен через middleware
    const userId = req.user?.id;
    if (!userId) {
      log('ID пользователя не найден');
      return res.status(500).json({ error: 'Ошибка сервера при получении NFT на продаже' });
    }
    
    log(`Получаем NFT на продаже (кроме пользователя ${userId})`);
    
    // Получаем NFT на продаже
    try {
      // Выполняем прямой SQL запрос для получения NFT из базы данных
      log('Получаем NFT напрямую из базы данных...');
      
      interface NftRow {
        id: number;
        token_id: string;
        collection_name: string;
        name: string;
        description: string;
        image_url: string;
        price: string;
        for_sale: boolean;
        owner_id: number;
        creator_id: number;
        regulator_id: number;
        created_at: Date;
      }
      
      let directNftsForSale: NftRow[] = [];
      
      try {
        // Используем типизированный запрос для PostgreSQL
        const nftsResult = await client.query<NftRow>(`
          SELECT * FROM nft 
          WHERE for_sale = true AND owner_id != $1
          ORDER BY id DESC
          LIMIT 100
        `, [userId]);
        
        directNftsForSale = nftsResult.rows;
        log(`Найдено ${directNftsForSale.length} NFT через прямой SQL запрос`);
      } catch (sqlError) {
        console.error('Ошибка при выполнении SQL запроса:', sqlError);
        log('Ошибка при выполнении SQL запроса');
      }
      
      // Если нашли NFT через SQL, форматируем и отправляем
      if (directNftsForSale.length > 0) {
        const formattedDirectNFTs = await Promise.all(directNftsForSale.map(async (nft) => {
          const owner = await storage.getUser(nft.owner_id);
          return {
            id: nft.id,
            tokenId: nft.token_id,
            collectionName: nft.collection_name,
            name: nft.name,
            description: nft.description,
            imagePath: nft.image_url, // Используем image_url как imagePath для совместимости с фронтендом
            imageUrl: nft.image_url, // Оставляем и оригинальное поле для обратной совместимости
            price: nft.price,
            forSale: nft.for_sale,
            ownerId: nft.owner_id,
            creatorId: nft.creator_id,
            ownerUsername: owner ? owner.username : 'Unknown',
            // Добавляем базовые атрибуты для совместимости с фронтендом
            attributes: {
              power: 70, 
              agility: 65, 
              wisdom: 60, 
              luck: 75
            }
          };
        }));
        
        log(`Отправляем ${formattedDirectNFTs.length} NFT клиенту (из SQL)`);
        return res.status(200).json(formattedDirectNFTs);
      }
      
      // Если не нашли через SQL, пробуем через сервис
      log('SQL запрос не вернул результатов, пробуем через сервис...');
      const nftsForSale = await boredApeNftService.getNFTsForSale(userId);
      log(`Найдено ${nftsForSale.length} NFT на продаже через сервис`);
      
      if (nftsForSale.length > 0) {
        // Добавляем информацию о владельцах
        const formattedNFTs = await Promise.all(nftsForSale.map(async (nft) => {
          const owner = await storage.getUser(nft.ownerId);
          return {
            ...nft,
            ownerUsername: owner ? owner.username : 'Unknown',
            // Добавляем базовые атрибуты для совместимости с фронтендом, если их нет
            attributes: nft.attributes || {
              power: 70, 
              agility: 65, 
              wisdom: 60, 
              luck: 75
            }
          };
        }));
        
        log(`Отправляем ${formattedNFTs.length} NFT клиенту (из сервиса)`);
        return res.status(200).json(formattedNFTs);
      }
      
      // Если ничего не нашли, возвращаем пустой массив
      log('NFT для маркетплейса не найдены ни через SQL, ни через сервис');
      return res.status(200).json([]);
    } catch (innerError) {
      console.error('Ошибка при обработке NFT для маркетплейса:', innerError);
      res.status(500).json({ error: 'Ошибка сервера при получении NFT на продаже' });
    }
  } catch (error) {
    console.error('Ошибка при получении NFT на продаже:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении NFT на продаже' });
  }
});