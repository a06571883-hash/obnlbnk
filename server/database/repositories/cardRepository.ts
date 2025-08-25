import { db } from "../connection";
import { cards } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";
import type { Card } from "../../../shared/schema.js";

export class CardRepository {
  static async getById(id: number): Promise<Card | null> {
    const result = await db.select().from(cards).where(eq(cards.id, id));
    return result.length > 0 ? result[0] : null;
  }

  static async getByUserId(userId: number): Promise<Card[]> {
    return await db.select().from(cards).where(eq(cards.userId, userId));
  }

  static async create(card: Omit<Card, "id">): Promise<Card> {
    const result = await db.insert(cards).values(card).returning();
    if (result.length === 0) {
      throw new Error("Failed to insert card");
    }
    return result[0];
  }

  static async updateBalance(cardId: number, balance: string): Promise<Card | null> {
    const result = await db
      .update(cards)
      .set({ balance })
      .where(eq(cards.id, cardId))
      .returning();

    return result.length > 0 ? result[0] : null;
  }
}
