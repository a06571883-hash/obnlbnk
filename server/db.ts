import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';
import { neonConfig } from '@neondatabase/serverless';

// Configure websocket for Neon
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

// Create a new connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  max: 20,
  idleTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: true
});

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  console.log('New database connection established');
  // Only log the non-sensitive part of the URL
  const dbUrl = process.env.DATABASE_URL || '';
  const sanitizedUrl = dbUrl.split('@')[1] || 'unknown';
  console.log('Connected to database:', sanitizedUrl);
});

// Create a drizzle database instance
export const db = drizzle(pool, { schema });

// Test database connection and log content
async function logDatabaseContent() {
  try {
    console.log('Testing database connection...');
    const usersResult = await db.select().from(schema.users);
    console.log('Successfully connected to database');
    console.log('Users count:', usersResult.length);
    const cardsResult = await db.select().from(schema.cards);
    console.log('Cards count:', cardsResult.length);
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error; // Propagate the error
  }
}

// Export the initialization function
export async function initializeDatabase() {
  try {
    await logDatabaseContent();
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing pool...');
  pool.end();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing pool...');
  pool.end();
});

// Initialize the database connection
initializeDatabase().catch(console.error);