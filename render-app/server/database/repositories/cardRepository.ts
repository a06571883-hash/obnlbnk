
import { db } from '../connection';
import { cards } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { Card } from '@shared/schema';

export class CardRepository {
  static async getById(id: number): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card;
  }

  static async getByUserId(userId: number): Promise<Card[]> {
    return await db.select().from(cards).where(eq(cards.userId, userId));
  }

  static async create(card: Omit<Card, "id">): Promise<Card> {
    const [newCard] = await db.insert(cards).values(card).returning();
    return newCard;
  }

  static async updateBalance(cardId: number, balance: string): Promise<void> {
    await db.update(cards)
      .set({ balance: balance })
      .where(eq(cards.id, cardId));
  }
}
