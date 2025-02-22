import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please create a database in Replit.");
}

// Create a connection pool with optimized settings for high reliability
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3, // Reduce max connections to prevent connection exhaustion
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  maxUses: 7500, // Close connections after 7500 queries
  allowExitOnIdle: true,
  ssl: {
    rejectUnauthorized: false
  }
});

// Enhanced error handling for pool events
pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
  // Attempt to clean up and reconnect
  try {
    pool.end().catch(console.error);
    console.log('Attempting to reconnect to database...');
    pool.connect().catch(console.error);
  } catch (e) {
    console.error('Failed to handle pool error:', e);
  }
});

// Connection monitoring
pool.on('connect', () => {
  console.log('New database connection established');
});

pool.on('acquire', () => {
  console.log('Connection acquired from pool');
});

pool.on('remove', () => {
  console.log('Connection removed from pool');
});

// Initial connection test
pool.connect()
  .then(() => console.log('Initial database connection successful'))
  .catch(err => {
    console.error('Initial database connection failed:', err);
    process.exit(1); // Exit if initial connection fails
  });

export const db = drizzle(pool, { schema });
export { pool };