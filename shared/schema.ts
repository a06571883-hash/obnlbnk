
import { pgTable, text, serial, integer, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isRegulator: boolean("is_regulator").notNull().default(false),
  regulatorBalance: decimal("regulator_balance").notNull().default("0"),
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  number: text("number").notNull(),
  expiry: text("expiry").notNull(),
  cvv: text("cvv").notNull(),
  balance: decimal("balance").notNull().default("0"),
  btcAddress: text("btc_address"),
  ethAddress: text("eth_address"),
});

export const insertUserSchema = createInsertSchema(users);
export const insertCardSchema = createInsertSchema(cards);

export type User = typeof users.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCard = z.infer<typeof insertCardSchema>;
