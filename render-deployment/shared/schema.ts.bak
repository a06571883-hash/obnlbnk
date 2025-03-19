import { sqliteTable, text, integer, numeric, integer as int, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// SQLite не имеет decimal/timestamp типов как в PostgreSQL, поэтому используем текст/число
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  is_regulator: integer("is_regulator", { mode: "boolean" }).notNull().default(false),
  regulator_balance: text("regulator_balance").notNull().default("0"),
  last_nft_generation: integer("last_nft_generation", { mode: "timestamp" }),
  nft_generation_count: integer("nft_generation_count").notNull().default(0),
});

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  number: text("number").notNull(),
  expiry: text("expiry").notNull(),
  cvv: text("cvv").notNull(),
  balance: text("balance").notNull().default("0"),
  btcBalance: text("btc_balance").notNull().default("0"),
  ethBalance: text("eth_balance").notNull().default("0"),
  btcAddress: text("btc_address"),
  ethAddress: text("eth_address"),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromCardId: integer("from_card_id").notNull(),
  toCardId: integer("to_card_id"),
  amount: text("amount").notNull(),
  convertedAmount: text("converted_amount").notNull(),
  type: text("type").notNull(),
  wallet: text("wallet"),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  description: text("description").notNull().default(""),
  fromCardNumber: text("from_card_number").notNull(),
  toCardNumber: text("to_card_number"), // Разрешаем NULL для переводов на внешние адреса
});

export const exchangeRates = sqliteTable("exchange_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usdToUah: text("usd_to_uah").notNull(),
  btcToUsd: text("btc_to_usd").notNull(),
  ethToUsd: text("eth_to_usd").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
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
  btcAddress: z.string().nullable(),
  ethAddress: z.string().nullable(),
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

// Экспорт типов
export type User = typeof users.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type ExchangeRateResponse = {
  usdToUah: string;
  btcToUsd: string;
  ethToUsd: string;
  updatedAt?: Date;
};