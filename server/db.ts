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
  max: 1, // Reduce connection pool size
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Improved error handling
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  // Don't end the pool on every error, only try to reconnect if needed
  if (!pool.totalCount) {
    console.log('Attempting to reconnect...');
    pool.connect().catch(console.error);
  }
});

pool.on('connect', () => {
  console.log('Database connection established');
});

// Export the db instance
export const db = drizzle(pool, { schema });
// Export pool for session store
export { pool };