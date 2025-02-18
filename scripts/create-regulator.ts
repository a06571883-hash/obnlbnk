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

  const hashedPassword = await hashPassword(password);

  const user = await storage.createUser({
    username,
    password: hashedPassword,
    isRegulator: true,
    regulatorBalance: "80000000" // 80 миллионов для регулятора
  });

  console.log("Created regulator account:", {
    username,
    password,
    userId: user.id
  });
}

createRegulator().catch(console.error);