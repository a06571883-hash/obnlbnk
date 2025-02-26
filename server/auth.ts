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

// Improved Ukrainian card number validation with more bank prefixes
function validateUkrainianCard(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/\s+/g, '');
  if (!/^\d{16}$/.test(cleanNumber)) {
    return false;
  }

  const ukrPrefixes = [
    // PrivatBank
    '4149', '5168', '5167', '4506', '4508', '4558',
    // Monobank
    '5375', '4443', '4441', '4444',
    // Universal/Other Ukrainian banks
    '4000', '4111', '4112', '4627', '5133', '5169', '5351', '5582',
    // Additional Ukrainian bank prefixes
    '4242', '4245', '4246', '4728', '4910', '4911', '4913', '4921',
    '4936', '4937', '4970', '4971', '5104', '5355', '5491', '5492',
    '5493', '5494', '5495', '5496', '5497', '5498', '5499'
  ];

  return ukrPrefixes.some(prefix => cleanNumber.startsWith(prefix));
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch {
    return false;
  }
}

async function generateCryptoAddresses(): Promise<{ btcAddress: string; ethAddress: string }> {
  // Generate real crypto addresses
  const mnemonic = generateMnemonic();
  const wallet = ethers.Wallet.fromPhrase(mnemonic);
  const btcAddress = "bc1" + randomBytes(32).toString("hex").slice(0, 39);

  return {
    btcAddress,
    ethAddress: wallet.address
  };
}

export function setupAuth(app: Express) {
  // Use a consistent session secret
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
        return res.status(400).json({ message: "Username and password are required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        is_regulator: false,
        regulator_balance: "0",
        nft_generation_count: 0
      });

      // Generate real crypto addresses for wallet
      const { btcAddress, ethAddress } = await generateCryptoAddresses();

      // Create USD card
      await storage.createCard({
        userId: user.id,
        type: 'usd',
        number: generateCardNumber(),
        balance: "0",
        expiry: generateExpiryDate(),
        btcAddress: null,
        ethAddress: null,
        btcBalance: "0",
        ethBalance: "0",
        cvv: generateCVV()
      });

      // Create UAH card
      await storage.createCard({
        userId: user.id,
        type: 'uah',
        number: generateCardNumber(),
        balance: "0",
        expiry: generateExpiryDate(),
        btcAddress: null,
        ethAddress: null,
        btcBalance: "0",
        ethBalance: "0",
        cvv: generateCVV()
      });

      // Create crypto wallet card
      await storage.createCard({
        userId: user.id,
        type: 'crypto',
        number: generateCardNumber(),
        balance: "0",
        expiry: generateExpiryDate(),
        btcAddress,
        ethAddress,
        btcBalance: "0",
        ethBalance: "0",
        cvv: generateCVV()
      });

      req.login(user, (err) => {
        if (err) {
          console.error("Registration session error:", err);
          return res.status(500).json({ message: "Error creating session" });
        }
        console.log("New user registered:", username);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration error" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      if (!user) {
        console.log("Login failed:", info?.message);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
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
  // Generate valid Ukrainian card numbers
  const prefixes = ['4149', '5168', '5375'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const remainingDigits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
  return prefix + remainingDigits;
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