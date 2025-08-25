
import { db } from '../connection';
import { users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import type { User, InsertUser } from '../../../shared/schema';

export class UserRepository {
  static async getById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  static async getByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  static async create(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  static async updateRegulatorBalance(userId: number, balance: string): Promise<void> {
    await db.update(users)
      .set({ regulator_balance: balance })
      .where(eq(users.id, userId));
  }
}
