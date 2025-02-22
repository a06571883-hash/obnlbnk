import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";

// Создаем локальную SQLite базу данных
const sqlite = new Database('sqlite.db');

// Создаем подключение к базе данных
export const db = drizzle(sqlite, { schema });
export { sqlite as pool };