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
  connectionTimeoutMillis: 10000,
  max: 20,
  idleTimeoutMillis: 10000,
  allowExitOnIdle: false
});

// Add error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1); // Let the process manager handle restart
});

// Add health check
setInterval(async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as value');
    client.release();

    if (!result.rows[0] || result.rows[0].value !== 1) {
      throw new Error('Health check failed');
    }
  } catch (err) {
    console.error('Health check failed:', err);
    process.exit(-1); // Let the process manager handle restart
  }
}, 5000);

export const db = drizzle(pool, { schema });

// Export pool for session store usage
export { pool };