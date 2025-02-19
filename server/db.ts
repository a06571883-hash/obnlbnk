import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: {
    rejectUnauthorized: false // Required for Replit's PostgreSQL
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

export const db = drizzle(pool);

// Export pool for session store usage
export { pool };