import { pgTable, text, integer, boolean, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// Используем PostgreSQL типы данных
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
    is_regulator: boolean("is_regulator").notNull().default(false),
    regulator_balance: text("regulator_balance").notNull().default("0"),
    last_nft_generation: timestamp("last_nft_generation"),
    nft_generation_count: integer("nft_generation_count").notNull().default(0),
});
export const cards = pgTable("cards", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    type: text("type").notNull(),
    number: text("number").notNull(),
    expiry: text("expiry").notNull(),
    cvv: text("cvv").notNull(),
    balance: text("balance").notNull().default("0"),
    btcBalance: text("btc_balance").notNull().default("0"),
    ethBalance: text("eth_balance").notNull().default("0"),
    kichcoinBalance: text("kichcoin_balance").notNull().default("0"),
    btcAddress: text("btc_address"),
    ethAddress: text("eth_address"),
    tonAddress: text("ton_address"),
});
export const transactions = pgTable("transactions", {
    id: serial("id").primaryKey(),
    fromCardId: integer("from_card_id").notNull(),
    toCardId: integer("to_card_id"),
    amount: text("amount").notNull(),
    convertedAmount: text("converted_amount").notNull(),
    type: text("type").notNull(),
    wallet: text("wallet"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    description: text("description").notNull().default(""),
    fromCardNumber: text("from_card_number").notNull(),
    toCardNumber: text("to_card_number"), // Разрешаем NULL для переводов на внешние адреса
});
export const exchangeRates = pgTable("exchange_rates", {
    id: serial("id").primaryKey(),
    usdToUah: text("usd_to_uah").notNull(),
    btcToUsd: text("btc_to_usd").notNull(),
    ethToUsd: text("eth_to_usd").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
// NFT коллекции
export const nftCollections = pgTable("nft_collections", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    coverImage: text("cover_image"),
    createdAt: timestamp("created_at").notNull().defaultNow()
});
// NFT
export const nfts = pgTable("nfts", {
    id: serial("id").primaryKey(),
    collectionId: integer("collection_id").notNull().references(() => nftCollections.id),
    ownerId: integer("owner_id").notNull().references(() => users.id), // Текущий владелец NFT
    name: text("name").notNull(),
    description: text("description"),
    imagePath: text("image_path").notNull(),
    attributes: jsonb("attributes"),
    rarity: text("rarity").notNull().default("common"),
    price: text("price").default("0"), // Цена для продажи, 0 - не продается
    forSale: boolean("for_sale").notNull().default(false), // Выставлен ли на продажу
    mintedAt: timestamp("minted_at").notNull().defaultNow(),
    tokenId: text("token_id").notNull(),
    originalImagePath: text("original_image_path"), // Путь к оригинальному изображению, которое не должно меняться
    sortOrder: integer("sort_order") // Порядок сортировки для стабильного отображения
});
// История передачи NFT (продажи, дарения)
export const nftTransfers = pgTable("nft_transfers", {
    id: serial("id").primaryKey(),
    nftId: integer("nft_id").notNull().references(() => nfts.id),
    fromUserId: integer("from_user_id").notNull().references(() => users.id),
    toUserId: integer("to_user_id").notNull().references(() => users.id),
    transferType: text("transfer_type").notNull(), // gift, sale
    price: text("price").default("0"), // Цена, если была продажа
    transferredAt: timestamp("transferred_at").notNull().defaultNow(),
});
// Базовые схемы
export const insertUserSchema = createInsertSchema(users, {
    id: undefined,
    username: z.string(),
    password: z.string(),
    regulator_balance: z.string().default("0"),
    is_regulator: z.boolean().default(false),
    last_nft_generation: z.date().optional(),
    nft_generation_count: z.number().default(0),
});
// Расширенная схема только для новых пользователей
export const newUserRegistrationSchema = insertUserSchema.extend({
    username: z.string()
        .min(3, 'Имя пользователя должно содержать не менее 3 символов')
        .max(20, 'Имя пользователя не должно превышать 20 символов')
        .regex(/^[a-zA-Z0-9_]+$/, 'Имя пользователя может содержать только латинские буквы, цифры и знак подчеркивания'),
    password: z.string()
        .min(6, 'Пароль должен содержать не менее 6 символов')
        .max(64, 'Пароль не должен превышать 64 символа')
        .regex(/.*[A-Z].*/, 'Пароль должен содержать хотя бы одну заглавную букву')
        .regex(/.*[0-9].*/, 'Пароль должен содержать хотя бы одну цифру'),
});
export const insertCardSchema = createInsertSchema(cards, {
    id: undefined,
    balance: z.string().default("0"),
    btcBalance: z.string().default("0"),
    ethBalance: z.string().default("0"),
    kichcoinBalance: z.string().default("0"),
    btcAddress: z.string().nullable(),
    ethAddress: z.string().nullable(),
    tonAddress: z.string().nullable(),
});
export const insertTransactionSchema = z.object({
    fromCardId: z.number(),
    toCardId: z.number().nullable(),
    amount: z.string(),
    convertedAmount: z.string(),
    type: z.string(),
    wallet: z.string().nullable(),
    status: z.string(),
    description: z.string().default(""),
    fromCardNumber: z.string(),
    toCardNumber: z.string().nullable(), // Разрешаем NULL
    createdAt: z.date().optional(),
});
export const insertNftCollectionSchema = createInsertSchema(nftCollections, {
    id: undefined,
    createdAt: undefined,
});
export const insertNftSchema = createInsertSchema(nfts, {
    id: undefined,
    mintedAt: undefined,
});
export const insertNftTransferSchema = createInsertSchema(nftTransfers, {
    id: undefined,
    transferredAt: undefined,
});
