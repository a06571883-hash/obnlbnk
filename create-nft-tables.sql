-- Создание таблицы nft_collections
CREATE TABLE IF NOT EXISTS "nft_collections" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "cover_image" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Создание таблицы nfts
CREATE TABLE IF NOT EXISTS "nfts" (
  "id" SERIAL PRIMARY KEY,
  "collection_id" INTEGER NOT NULL REFERENCES "nft_collections"("id"),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "image_path" TEXT NOT NULL,
  "attributes" JSONB,
  "rarity" TEXT NOT NULL DEFAULT 'common',
  "minted_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "token_id" TEXT NOT NULL
);