import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { ethers } from "ethers";
import { generateMnemonic } from "bip39";

const scryptAsync = promisify(scrypt);

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Simple card number validation - only checks format
function validateCardFormat(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/\s+/g, '');
  return /^\d{16}$/.test(cleanNumber);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    if (!stored || !stored.includes('.')) {
      console.log('Invalid stored password format');
      return false;
    }
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.log('Invalid password components');
      return false;
    }
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

async function generateCryptoAddresses(): Promise<{ btcAddress: string; ethAddress: string }> {
  const mnemonic = generateMnemonic();
  const wallet = ethers.Wallet.fromPhrase(mnemonic);
  const btcAddress = "bc1" + randomBytes(32).toString("hex").slice(0, 39);

  return {
    btcAddress,
    ethAddress: wallet.address
  };
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');

  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
      httpOnly: true
    },
    name: 'bnal.sid'
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log('Login failed: User not found:', username);
        return done(null, false, { message: "Invalid username or password" });
      }

      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        console.log('Login failed: Invalid password for user:', username);
        return done(null, false, { message: "Invalid username or password" });
      }

      console.log('Login successful for user:', username);
      return done(null, user);
    } catch (error) {
      console.error("Authentication error:", error);
      return done(error);
    }
  }));

  passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user:', id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log('User not found during deserialization:', id);
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Deserialization error:", error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        console.log("Registration failed: Missing username or password");
        return res.status(400).json({ message: "Username and password are required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log("Registration failed: Username already exists:", username);
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(password);
      console.log("Creating new user with username:", username);

      const user = await storage.createUser({
        username,
        password: hashedPassword,
        is_regulator: false,
        regulator_balance: "0",
        nft_generation_count: 0
      });

      req.login(user, (err) => {
        if (err) {
          console.error("Registration session error:", err);
          return res.status(500).json({ message: "Error creating session" });
        }
        console.log("New user registered successfully:", username);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration error" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Login attempt for username:", req.body.username);

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      if (!user) {
        console.log("Login failed for user:", req.body.username);
        return res.status(401).json({ message: "Неверное имя пользователя или пароль" });
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error("Login session error:", err);
          return next(err);
        }
        console.log("User logged in successfully:", user.username);
        res.json(user);
      });
    })(req, res, next);
  });

  app.get("/api/user", (req, res) => {
    console.log('Session ID:', req.sessionID);
    console.log('Is authenticated:', req.isAuthenticated());
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    console.log("User session active:", req.user.username);
    res.json(req.user);
  });

  app.post("/api/logout", (req, res) => {
    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout error" });
      }
      console.log("User logged out:", username);
      res.sendStatus(200);
    });
  });
}

function generateCardNumber(): string {
  const digits = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join("");
  return digits;
}

function generateExpiryDate(): string {
  const now = new Date();
  const expYear = now.getFullYear() + 4;
  const expMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${expMonth}/${expYear.toString().slice(-2)}`;
}

function generateCVV(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}