import { pgTable, text, serial, integer, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  is_regulator: boolean("is_regulator").notNull().default(false),
  regulator_balance: decimal("regulator_balance", { precision: 20, scale: 8 }).notNull().default("0"),
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
  balance: decimal("balance", { precision: 20, scale: 8 }).notNull().default("0"),
  btcBalance: decimal("btc_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  ethBalance: decimal("eth_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  btcAddress: text("btc_address"),
  ethAddress: text("eth_address"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromCardId: integer("from_card_id").notNull(),
  toCardId: integer("to_card_id"),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  convertedAmount: decimal("converted_amount", { precision: 20, scale: 8 }).notNull(),
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
  usdToUah: decimal("usd_to_uah", { precision: 10, scale: 2 }).notNull(),
  btcToUsd: decimal("btc_to_usd", { precision: 10, scale: 2 }).notNull(),
  ethToUsd: decimal("eth_to_usd", { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Базовые схемы
export const insertUserSchema = createInsertSchema(users, {
  id: undefined,
  regulator_balance: z.string().default("0"),
  is_regulator: z.boolean().default(false),
  last_nft_generation: z.date().optional(),
  nft_generation_count: z.number().default(0),
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