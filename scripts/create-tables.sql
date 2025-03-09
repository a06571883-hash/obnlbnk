-- Create tables for the database

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "username" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "is_regulator" BOOLEAN NOT NULL DEFAULT false,
    "regulator_balance" DECIMAL(20, 8) NOT NULL DEFAULT '0',
    "last_nft_generation" TIMESTAMP,
    "nft_generation_count" INTEGER NOT NULL DEFAULT 0
);

-- Create cards table
CREATE TABLE IF NOT EXISTS "cards" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "expiry" TEXT NOT NULL,
    "cvv" TEXT NOT NULL,
    "balance" DECIMAL(20, 8) NOT NULL DEFAULT '0',
    "btc_balance" DECIMAL(20, 8) NOT NULL DEFAULT '0',
    "eth_balance" DECIMAL(20, 8) NOT NULL DEFAULT '0',
    "btc_address" TEXT,
    "eth_address" TEXT
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" SERIAL PRIMARY KEY,
    "from_card_id" INTEGER NOT NULL,
    "to_card_id" INTEGER,
    "amount" DECIMAL(20, 8) NOT NULL,
    "converted_amount" DECIMAL(20, 8) NOT NULL,
    "type" TEXT NOT NULL,
    "wallet" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL DEFAULT '',
    "from_card_number" TEXT NOT NULL,
    "to_card_number" TEXT
);

-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS "exchange_rates" (
    "id" SERIAL PRIMARY KEY,
    "usd_to_uah" DECIMAL(10, 2) NOT NULL,
    "btc_to_usd" DECIMAL(10, 2) NOT NULL,
    "eth_to_usd" DECIMAL(10, 2) NOT NULL,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create session table for storing sessions
CREATE TABLE IF NOT EXISTS "session" (
    "sid" TEXT NOT NULL PRIMARY KEY,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "cards_user_id_idx" ON "cards" ("user_id");
CREATE INDEX IF NOT EXISTS "transactions_from_card_id_idx" ON "transactions" ("from_card_id");
CREATE INDEX IF NOT EXISTS "transactions_to_card_id_idx" ON "transactions" ("to_card_id");
CREATE INDEX IF NOT EXISTS "session_expire_idx" ON "session" ("expire");