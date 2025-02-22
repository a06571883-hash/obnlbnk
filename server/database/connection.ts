import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// Create a new postgres connection
const client = postgres(process.env.DATABASE_URL);

// Create a drizzle database instance
export const db = drizzle(client, { schema });
export { client as pool };