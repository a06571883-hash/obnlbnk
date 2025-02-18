
import { storage } from "../server/storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createRegulator() {
  const username = "admin";
  const password = "admin123";
  
  const user = await storage.createUser({
    username,
    password: await hashPassword(password),
    isRegulator: true
  });
  
  console.log("Created regulator account:", {
    username,
    password
  });
}

createRegulator();
