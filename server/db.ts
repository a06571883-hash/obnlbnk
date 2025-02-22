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

// Configure pool with optimal settings
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000, // Increased timeout
  max: 10, // Reduced max connections
  idleTimeoutMillis: 60000, // Increased idle timeout
  allowExitOnIdle: false
});

// Add error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit process, just log the error
  console.error('Database error occurred:', err);
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