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
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Better error handling
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Attempt to reconnect
  pool.end().catch(console.error);
  setTimeout(() => {
    console.log('Attempting to reconnect to database...');
    pool.connect().catch(console.error);
  }, 5000);
});

// Connection success
pool.on('connect', () => {
  console.log('Database connected successfully');
});

// Test the connection
pool.connect()
  .then(() => console.log('Initial database connection successful'))
  .catch(err => console.error('Initial database connection failed:', err));

export const db = drizzle(pool, { schema });
export { pool };