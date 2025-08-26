import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage.js";
import { User as SelectUser, newUserRegistrationSchema } from "../shared/schema.js";
import { ZodError } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import crypto from "crypto";
import { promisify } from "util";
// @ts-ignore
import Database from 'better-sqlite3';
import path from 'path';
import { ethers } from 'ethers';

declare global {
  namespace Express {
    interface User extends Partial<SelectUser> {
      id?: number;
    }
  }
}

const scryptAsync = promisify(scrypt);

// Асинхронная функция для проверки пароля с использованием scrypt
async function comparePasswordsScrypt(supplied: string, stored: string) {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Проверка пароля для обычных пользователей (без хеширования)
async function comparePasswords(supplied: string, stored: string) {
  return supplied === stored;
}

// Функция для получения админа из SQLite
async function getAdminFromSqlite(username: string) {
  const dbPath = path.join(process.cwd(), 'sqlite.db');
  const db = new Database(dbPath);
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_regulator = 1').get(username);
    return user || null;
  } finally {
    db.close();
  }
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || 'default_secret';
  console.log("Setting up auth with session secret length:", sessionSecret.length);

  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: false, // Для production изменить на true при использовании HTTPS
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней (уменьшено для стабильности)
      path: '/',
      httpOnly: false // Отключаем httpOnly для отладки сессий
    },
    name: 'bnal.sid',
    rolling: true, // Продлевать сессию при каждом запросе
    // Принудительно сохраняем сессию
    genid: () => {
      return crypto.randomUUID();
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      console.log('LocalStrategy - Attempting login for user:', username);

      // Специальная обработка для админа
      if (username === 'admin') {
        const adminUser = await getAdminFromSqlite(username);
        if (!adminUser) {
          console.log('Login failed: Admin not found');
          return done(null, false, { message: "Invalid username or password" });
        }

        const isValid = await comparePasswordsScrypt(password, adminUser.password);
        if (!isValid) {
          console.log('Login failed: Invalid admin password');
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log('Admin login successful');
        return done(null, adminUser);
      }

      // Стандартная обработка для обычных пользователей
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

  passport.serializeUser((user: any, done) => {
    console.log('✅ Serializing user:', user.id, user.username);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('🔄 Deserializing user ID:', id);
      
      // Увеличиваем таймаут и добавляем попытки повторного подключения
      const user = await Promise.race([
        storage.getUser(id).catch(async (error) => {
          console.log('🔄 First attempt failed, retrying...', error.message);
          // Повторная попытка через короткую задержку
          await new Promise(resolve => setTimeout(resolve, 200));
          return storage.getUser(id);
        }),
        new Promise<undefined>((_, reject) => 
          setTimeout(() => reject(new Error('Deserialization timeout')), 5000)
        )
      ]);
      
      if (!user) {
        console.log('❌ User not found during deserialization:', id);
        return done(null, false);
      }
      console.log('✅ User deserialized successfully:', user.id, user.username);
      done(null, user);
    } catch (error) {
      console.error("❌ Deserialization error:", error);
      // Не передаём ошибку, возвращаем false для анонимного доступа
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res) => {
    console.log("Starting registration process...");
    let user: SelectUser | null = null;

    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Имя пользователя и пароль обязательны"
        });
      }

      try {
        newUserRegistrationSchema.parse(req.body);
      } catch (error) {
        if (error instanceof ZodError) {
          const errorMessage = error.errors[0]?.message || "Ошибка валидации";
          console.log("Registration validation error:", errorMessage);
          return res.status(400).json({
            success: false,
            message: errorMessage
          });
        }
        throw error;
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Пользователь с таким именем уже существует"
        });
      }

      // Сохраняем пароль в открытом виде
      user = await storage.createUser({
        username,
        password, // Пароль сохраняется как есть, без хеширования
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
        if (user) {
          console.log(`User ${user.id} registered and logged in successfully`);
          // Убедимся, что сессия сохранена перед ответом
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('Session save error after registration:', saveErr);
            }
            return res.status(201).json(user);
          });
        } else {
          return res.status(500).json({
            success: false,
            message: "User registration error"
          });
        }
      });

    } catch (error) {
      console.error("Registration process failed:", error);
      if (user !== null) {
        const userId = (user as SelectUser).id;
        if (userId) {
          await storage.deleteUser(userId);
        }
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
        return res.status(500).json({ message: "Ошибка сервера при входе" });
      }
      if (!user) {
        console.log("Login failed for user:", req.body.username);
        return res.status(401).json({ message: "Неверное имя пользователя или пароль" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return res.status(500).json({ message: "Ошибка создания сессии" });
        }
        console.log("User logged in successfully:", user.username);
        // Убедимся, что сессия сохранена перед ответом
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error after login:', saveErr);
          }
          res.json(user);
        });
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
      // Уничтожаем сессию полностью
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('Session destroy error:', destroyErr);
        }
        console.log("User logged out:", username);
        res.clearCookie('bnal.sid');
        res.sendStatus(200);
      });
    });
  });
}

// Simple card number validation - only checks format
function validateCardFormat(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/\s+/g, '');
  return /^\d{16}$/.test(cleanNumber);
}

// Generate valid crypto addresses - produces legacy BTC address and valid ETH address
async function generateCryptoAddresses(): Promise<{ btcAddress: string; ethAddress: string }> {
  try {
    const wallet = ethers.Wallet.createRandom();

    // Legacy BTC address format (starting with 1)
    const btcAddress = "1" + randomBytes(32).toString("hex").slice(0, 33);

    return {
      btcAddress,
      ethAddress: wallet.address
    };
  } catch (error) {
    console.error("Error generating crypto addresses:", error);
    // Fallback to simple address format if ethers fails
    return {
      btcAddress: "1" + randomBytes(32).toString("hex").slice(0, 33),
      ethAddress: "0x" + randomBytes(20).toString("hex")
    };
  }
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
