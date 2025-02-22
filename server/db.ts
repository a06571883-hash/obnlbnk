import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// Create a new postgres connection with proper configuration
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  max_lifetime: 60 * 30
});

// Create a drizzle database instance
const db = drizzle(client, { schema });

// Improved error handling (adapted from original)
client.on('error', (err) => {
  console.error('Unexpected database error:', err);
  // Don't end the pool on every error, only try to reconnect if needed
  if (!client.connected) {
    console.log('Attempting to reconnect...');
    client.connect().catch(console.error);
  }
});

client.on('connect', () => {
  console.log('Database connection established');
});


export { db, client as pool };