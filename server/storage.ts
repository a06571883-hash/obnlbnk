import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./database/connection";
import { UserRepository } from "./database/repositories/userRepository";
import { CardRepository } from "./database/repositories/cardRepository";
import type { User, Card, InsertUser } from "@shared/schema";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCardsByUserId(userId: number): Promise<Card[]>;
  createCard(card: Omit<Card, "id">): Promise<Card>;
  sessionStore: session.Store;
  getAllUsers: () => Promise<User[]>;
  updateRegulatorBalance: (userId: number, balance: string) => Promise<void>;
  updateCardBalance: (cardId: number, balance: string) => Promise<void>;
  getCardById: (cardId: number) => Promise<Card | undefined>;
  transferMoney: (fromCardId: number, toCardNumber: string, amount: number) => Promise<{ success: boolean; error?: string }>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
  }

  async getUser(id: number) {
    return UserRepository.getById(id);
  }

  async getUserByUsername(username: string) {
    return UserRepository.getByUsername(username);
  }

  async createUser(user: InsertUser) {
    return UserRepository.create(user);
  }

  async getCardsByUserId(userId: number) {
    return CardRepository.getByUserId(userId);
  }

  async createCard(card: Omit<Card, "id">) {
    return CardRepository.create(card);
  }

  async getAllUsers() {
    return UserRepository.getAll(); // Assuming getAll() exists in UserRepository
  }

  async updateRegulatorBalance(userId: number, balance: string) {
    await UserRepository.updateRegulatorBalance(userId, balance);
  }

  async updateCardBalance(cardId: number, balance: string) {
    await CardRepository.updateBalance(cardId, balance);
  }

  async getCardById(cardId: number) {
    return CardRepository.getById(cardId);
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number) {
    const fromCard = await this.getCardById(fromCardId);
    const toCard = await CardRepository.getByNumber(toCardNumber); // Assuming getByNumber() exists in CardRepository

    if (!fromCard || !toCard) {
      return { success: false, error: "Карта не найдена" };
    }

    const fromBalance = parseFloat(fromCard.balance);
    if (isNaN(fromBalance) || fromBalance < amount) {
      return { success: false, error: "Недостаточно средств" };
    }

    const toBalance = parseFloat(toCard.balance);
    if (isNaN(toBalance)) {
      return { success: false, error: "Ошибка в балансе получателя" };
    }

    const newFromBalance = (fromBalance - amount).toFixed(2);
    const newToBalance = (toBalance + amount).toFixed(2);

    await CardRepository.updateBalance(fromCard.id, newFromBalance);
    await CardRepository.updateBalance(toCard.id, newToBalance);

    return { success: true };
  }
}

export const storage = new DatabaseStorage();