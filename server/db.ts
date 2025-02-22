import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please create a database in Replit.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  maxUses: 7500,
  allowExitOnIdle: true,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
  try {
    pool.end().catch(console.error);
    console.log('Attempting to reconnect to database...');
    pool.connect().catch(console.error);
  } catch (e) {
    console.error('Failed to handle pool error:', e);
  }
});

pool.on('connect', () => {
  console.log('New database connection established');
});

pool.on('acquire', () => {
  console.log('Connection acquired from pool');
});

pool.on('remove', () => {
  console.log('Connection removed from pool');
});

pool.connect()
  .then(() => console.log('Initial database connection successful'))
  .catch(err => {
    console.error('Initial database connection failed:', err);
    process.exit(1);
  });

export const db = drizzle(pool, { schema });
export { pool };