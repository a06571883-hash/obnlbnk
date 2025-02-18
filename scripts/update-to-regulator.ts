
import { storage } from "../server/storage";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function updateToRegulator() {
  const username = "admin"; // Change this if needed
  
  await db.update(users)
    .set({ 
      is_regulator: true,
      regulator_balance: "80000000"
    })
    .where(eq(users.username, username));

  console.log("Updated user to regulator status:", username);
}

updateToRegulator().catch(console.error);
