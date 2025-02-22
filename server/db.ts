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

// Create a connection pool with optimal settings for Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Reduce max connections
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  maxUses: 100, // Close connection after 100 queries
  allowExitOnIdle: true
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit process on error
});

// Add health check with longer interval
let lastHealthCheck = Date.now();
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

async function performHealthCheck() {
  try {
    const now = Date.now();
    if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
      return; // Skip if too soon
    }

    const client = await pool.connect();
    try {
      const result = await client.query('SELECT 1 as value');
      if (!result.rows[0] || result.rows[0].value !== 1) {
        console.error('Health check returned unexpected result');
      }
    } finally {
      client.release();
      lastHealthCheck = now;
    }
  } catch (err) {
    console.error('Health check failed:', err);
    // Don't exit process, just log the error
  }
}

// Reduced frequency of health checks
setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL);

export const db = drizzle(pool, { schema });

// Export pool for session store usage
export { pool };