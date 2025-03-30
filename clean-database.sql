-- Удаление дубликатов из таблицы nft по token_id
WITH duplicates AS (
  SELECT id, token_id,
    ROW_NUMBER() OVER (PARTITION BY token_id ORDER BY id DESC) as row_num
  FROM nft
  WHERE token_id IS NOT NULL
)
DELETE FROM nft
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- Удаление дубликатов из таблицы nfts по tokenId
WITH duplicates AS (
  SELECT id, "tokenId",
    ROW_NUMBER() OVER (PARTITION BY "tokenId" ORDER BY id DESC) as row_num
  FROM nfts
  WHERE "tokenId" IS NOT NULL
)
DELETE FROM nfts
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- Обновление путей к изображениям в таблице nfts
UPDATE nfts
SET "imagePath" = '/bored_ape_nft/' || SUBSTRING("imagePath" FROM '[^/]+$')
WHERE name NOT ILIKE '%mutant%' 
  AND "imagePath" IS NOT NULL 
  AND "imagePath" NOT LIKE '/bored_ape_nft/%';

UPDATE nfts
SET "imagePath" = '/mutant_ape_nft/' || SUBSTRING("imagePath" FROM '[^/]+$')
WHERE name ILIKE '%mutant%' 
  AND "imagePath" IS NOT NULL 
  AND "imagePath" NOT LIKE '/mutant_ape_nft/%';

-- Удаление NFT с недействительными или отсутствующими путями к изображениям
DELETE FROM nfts
WHERE "imagePath" IS NULL OR "imagePath" = '';

-- Обновление имен NFT для Bored Ape и Mutant Ape
UPDATE nfts
SET name = 'Bored Ape #' || "tokenId"
WHERE name NOT ILIKE '%mutant%' 
  AND NOT name LIKE 'Bored Ape #%';

UPDATE nfts
SET name = 'Mutant Ape #' || "tokenId"
WHERE name ILIKE '%mutant%' 
  AND NOT name LIKE 'Mutant Ape #%';

-- Обновление названий коллекций
UPDATE nfts
SET "collectionName" = 'Bored Ape Yacht Club'
WHERE name NOT ILIKE '%mutant%' 
  AND ("collectionName" IS NULL OR "collectionName" != 'Bored Ape Yacht Club');

UPDATE nfts
SET "collectionName" = 'Mutant Ape Yacht Club'
WHERE name ILIKE '%mutant%' 
  AND ("collectionName" IS NULL OR "collectionName" != 'Mutant Ape Yacht Club');