
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users, cards } from "../shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);
