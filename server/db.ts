import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure pool with mobile-friendly settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  max: 2,
  idleTimeoutMillis: 30000
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Create a drizzle database instance
export const db = drizzle(pool, { schema });

// Ensure the pool is terminated when the application exits
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing pool...');
  pool.end();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing pool...');
  pool.end();
});