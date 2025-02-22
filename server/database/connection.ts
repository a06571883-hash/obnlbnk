
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Database error:', err);
  pool.end().catch(console.error);
  setTimeout(() => {
    console.log('Attempting reconnection...');
    pool.connect().catch(console.error);
  }, 5000);
});

pool.on('connect', () => {
  console.log('Database connected successfully');
});

export const db = drizzle(pool, { schema });
export { pool };
