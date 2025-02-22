import { pgTable, text, serial, integer, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  is_regulator: boolean("is_regulator").notNull().default(false),
  regulator_balance: decimal("regulator_balance", { precision: 10, scale: 2 }).notNull().default("0"),
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  number: text("number").notNull(),
  expiry: text("expiry").notNull(),
  cvv: text("cvv").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0"),
  btcAddress: text("btc_address"),
  ethAddress: text("eth_address"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromCardId: integer("from_card_id").notNull(),
  toCardId: integer("to_card_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  convertedAmount: decimal("converted_amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(), // 'transfer', 'deposit', 'withdraw'
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  description: text("description"),
  fromCardNumber: text("from_card_number"),
  toCardNumber: text("to_card_number"),
});

export const insertUserSchema = createInsertSchema(users);
export const insertCardSchema = createInsertSchema(cards);
export const insertTransactionSchema = createInsertSchema(transactions);

export type User = typeof users.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;