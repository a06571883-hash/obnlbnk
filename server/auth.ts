import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    console.log("Comparing passwords...");

    if (!stored || !stored.includes('.')) {
      console.error('Invalid stored password format');
      return false;
    }

    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.error('Invalid password components');
      return false;
    }

    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;

    const result = timingSafeEqual(hashedBuf, suppliedBuf);
    console.log("Password comparison result:", result);
    return result;
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
  console.log("Setting up auth with session secret length:", sessionSecret.length);

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
      console.log('LocalStrategy - Attempting login for user:', username);
      const user = await storage.getUserByUsername(username);

      if (!user) {
        console.log('Login failed: User not found:', username);
        return done(null, false, { message: "Invalid username or password" });
      }

      console.log('User found, comparing passwords');
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
      console.log('User deserialized successfully:', user.username);
      done(null, user);
    } catch (error) {
      console.error("Deserialization error:", error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res) => {
    console.log("Starting registration process...");
    let user = null;

    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ 
          success: false,
          message: "Username and password are required" 
        });
      }

      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ 
          success: false,
          message: "Username must be between 3 and 20 characters" 
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          success: false,
          message: "Password must be at least 6 characters long" 
        });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ 
          success: false,
          message: "Username already exists" 
        });
      }

      const hashedPassword = await hashPassword(password);

      try {
        user = await storage.createUser({
          username,
          password: hashedPassword,
          is_regulator: false,
          regulator_balance: "0",
          nft_generation_count: 0
        });

        console.log(`User created with ID: ${user.id}`);

        try {
          await storage.createDefaultCardsForUser(user.id);
          console.log(`Default cards created for user ${user.id}`);
        } catch (cardError) {
          console.error(`Failed to create cards for user ${user.id}:`, cardError);
          if (user) {
            await storage.deleteUser(user.id);
            console.log(`Cleaned up user ${user.id} after card creation failure`);
          }
          return res.status(500).json({ 
            success: false,
            message: "Failed to create user cards" 
          });
        }

        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error("Login after registration failed:", loginErr);
            return res.status(500).json({ 
              success: false,
              message: "Registration successful but login failed" 
            });
          }
          console.log(`User ${user.id} registered and logged in successfully`);
          return res.status(201).json({ 
            success: true,
            user 
          });
        });

      } catch (createError) {
        console.error("User creation failed:", createError);
        if (user) {
          await storage.deleteUser(user.id);
        }
        return res.status(500).json({ 
          success: false,
          message: "Failed to create user" 
        });
      }

    } catch (error) {
      console.error("Registration process failed:", error);
      if (user) {
        await storage.deleteUser(user.id);
      }
      return res.status(500).json({ 
        success: false,
        message: "Registration failed" 
      });
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
    console.log('GET /api/user - Session details:', {
      id: req.sessionID,
      isAuthenticated: req.isAuthenticated(),
      user: req.user?.username
    });

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

// Simple card number validation - only checks format
function validateCardFormat(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/\s+/g, '');
  return /^\d{16}$/.test(cleanNumber);
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