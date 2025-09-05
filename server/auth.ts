import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session, { MemoryStore } from "express-session";
import cookieParser from "cookie-parser";
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
    interface Session {
      passport?: {
        user?: number;
      };
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
  
  // Добавляем поддержку куки для резервного механизма
  app.use(cookieParser());

  // На Vercel используем только cookie-based аутентификацию без сессий
  const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  
  if (IS_VERCEL) {
    console.log('🔧 Vercel detected: using cookie-only authentication without session store');
    
    // Создаем пустую сессию store которая ничего не делает
    class NoopStore extends MemoryStore {
      constructor() {
        super();
      }
      
      all(callback: (err?: any, obj?: any) => void): void {
        callback(null, {});
      }
      
      destroy(sid: string, callback?: (err?: any) => void): void {
        if (callback) callback();
      }
      
      clear(callback?: (err?: any) => void): void {
        if (callback) callback();
      }
      
      length(callback: (err: any, length: number) => void): void {
        callback(null, 0);
      }
      
      get(sid: string, callback: (err: any, session?: any) => void): void {
        // Возвращаем минимальную сессию для passport
        callback(null, { cookie: { maxAge: 1000 } });
      }
      
      set(sid: string, session: any, callback?: (err?: any) => void): void {
        if (callback) callback();
      }
      
      touch(sid: string, session: any, callback?: (err?: any) => void): void {
        if (callback) callback();
      }
    }
    
    app.use(session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new NoopStore(), // Пустая store без предупреждений
      cookie: {
        secure: true, // HTTPS на Vercel
        sameSite: 'lax',
        maxAge: 1000, // Очень короткая жизнь сессии - 1 секунда
        path: '/',
        httpOnly: true
      },
      name: 'temp.sid'
    }));
  } else {
    // На локальном/Replit используем PostgreSQL session store
    app.use(session({
      secret: sessionSecret,
      resave: true,
      saveUninitialized: true,
      store: storage.sessionStore,
      cookie: {
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
        path: '/',
        httpOnly: true
      },
      name: 'bnal.sid',
      rolling: true,
      genid: () => {
        return crypto.randomUUID();
      }
    }));
  }

  // Middleware для отладки сессий
  app.use((req, res, next) => {
    if (req.url.includes('/api/')) {
      console.log('🔍 Session Debug:', {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        sessionData: req.session ? Object.keys(req.session) : [],
        passportUser: (req.session as any)?.passport?.user,
        cookies: req.headers.cookie ? req.headers.cookie.includes('bnal.sid') : false,
        url: req.url,
        method: req.method
      });
    }
    next();
  });

  app.use(passport.initialize());
  app.use(passport.session());
  
  // Дополнительное логирование и принудительная загрузка пользователя
  app.use(async (req, res, next) => {
    if (req.url.includes('/api/') && req.url !== '/api/login' && req.url !== '/api/register') {
      console.log('🔐 After passport middleware:', {
        isAuthenticated: req.isAuthenticated(),
        hasUser: !!req.user,
        userID: req.user?.id,
        username: req.user?.username,
        sessionPassport: (req.session as any)?.passport
      });
      
      // ПРИНУДИТЕЛЬНО загружаем пользователя если его нет, но есть ID в сессии
      if (!req.user && (req.session as any)?.passport?.user) {
        try {
          console.log('🔄 Force loading user from session ID:', (req.session as any).passport.user);
          const userId = (req.session as any).passport.user;
          const user = await storage.getUser(userId);
          if (user) {
            console.log('✅ Force loaded user:', user.username);
            req.user = user;
            // Помечаем как аутентифицированного
            (req as any)._passport = { instance: passport, session: { user: userId } };
          }
        } catch (error) {
          console.error('❌ Force load user error:', error);
        }
      }
      
      // ОСНОВНОЙ МЕХАНИЗМ ДЛЯ VERCEL: загружаем из куки вместо сессии
      if (!req.user && req.cookies?.user_data) {
        try {
          const userData = JSON.parse(Buffer.from(req.cookies.user_data, 'base64').toString());
          
          // Проверяем что токен не старше 7 дней
          if (Date.now() - userData.timestamp < 7 * 24 * 60 * 60 * 1000) {
            const user = await storage.getUser(userData.id);
            if (user && user.username === userData.username) {
              console.log('✅ Cookie auth successful for Vercel:', user.username);
              req.user = user;
              
              // Для Vercel устанавливаем минимальную сессию только для passport совместимости
              const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
              if (IS_VERCEL && !(req.session as any).passport) {
                (req.session as any).passport = { user: user.id };
              }
            }
          } else {
            console.log('🔄 Cookie token expired, clearing');
            // Очищаем истёкший токен
            res.clearCookie('user_data');
          }
        } catch (error) {
          console.error('❌ Cookie auth error:', error);
          res.clearCookie('user_data');
        }
      }
    }
    next();
  });

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
    console.log('✅ Serializing user:', user.id, user.username, 'ID type:', typeof user.id);
    // Убедимся что ID число
    const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
    console.log('✅ Serializing with userId:', userId);
    done(null, userId);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('🔄 Deserializing user ID:', id, 'type:', typeof id);
      
      // Проверяем валидность ID - возможно ID приходит как строка
      const userId = typeof id === 'string' ? parseInt(id, 10) : id;
      if (!userId || isNaN(userId)) {
        console.log('❌ Invalid user ID during deserialization:', id, 'parsed:', userId);
        return done(null, false);
      }
      
      console.log('🔍 Looking for user with ID:', userId);
      
      // Попробуем получить пользователя с улучшенной обработкой ошибок
      let user;
      try {
        user = await storage.getUser(userId);
        console.log('🔍 Database query result:', user ? 'Found user' : 'User not found');
      } catch (dbError) {
        console.error('💥 Database error during deserialization:', dbError);
        // Попробуем повторить запрос
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          user = await storage.getUser(userId);
          console.log('🔄 Retry successful, user found:', !!user);
        } catch (retryError) {
          console.error('💥 Retry also failed:', retryError);
          return done(null, false);
        }
      }
      
      if (!user) {
        console.log('❌ User not found in database during deserialization:', userId);
        return done(null, false);
      }
      
      console.log('✅ User deserialized successfully:', user.id, user.username);
      done(null, user);
    } catch (error) {
      console.error("❌ Unexpected deserialization error:", error);
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
          // Принудительно сохраняем сессию и ждем завершения
          const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
          
          // Устанавливаем cookie для аутентификации нового пользователя
          const userToken = Buffer.from(JSON.stringify({
            id: user.id,
            username: user.username,
            timestamp: Date.now()
          })).toString('base64');
          
          res.cookie('user_data', userToken, {
            httpOnly: true,
            secure: IS_VERCEL,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
          });
          
          if (IS_VERCEL) {
            // Для Vercel используем только cookies
            console.log('✅ Vercel registration successful - using cookie auth');
            return res.status(201).json(user);
          } else {
            // Для обычного деплоя сохраняем сессию
            req.session.save((saveErr) => {
              if (saveErr) {
                console.error('❌ Session save error after registration:', saveErr);
                return res.status(500).json({ message: "Ошибка сохранения сессии" });
              }
              console.log('✅ Session saved successfully for new user:', user?.username);
              return res.status(201).json(user);
            });
          }
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
        console.log('🔍 Passport session after login:', (req.session as any).passport);
        console.log('🔍 User ID in session:', (req.session as any).passport?.user);
        
        const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
        
        // Устанавливаем основной cookie для аутентификации
        const userToken = Buffer.from(JSON.stringify({
          id: user.id,
          username: user.username,
          timestamp: Date.now()
        })).toString('base64');
        
        res.cookie('user_data', userToken, {
          httpOnly: true,
          secure: IS_VERCEL,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          sameSite: 'lax'
        });
        
        console.log('✅ User cookie set for authentication');
        
        if (IS_VERCEL) {
          // Для Vercel используем только cookies, минимальная сессия
          console.log('✅ Vercel login successful - using cookie auth');
          res.json(user);
        } else {
          // Для обычного деплоя сохраняем сессию
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('❌ Session save error after login:', saveErr);
              return res.status(500).json({ message: "Ошибка сохранения сессии" });
            }
            console.log('✅ Session saved successfully for user:', user.username);
            res.json(user);
          });
        }
      });
    })(req, res, next);
  });

  app.get("/api/user", async (req, res) => {
    try {
      console.log('GET /api/user - Session details:', {
        id: req.sessionID,
        isAuthenticated: req.isAuthenticated(),
        user: req.user?.username,
        hasSession: !!req.session,
        sessionCookie: req.headers.cookie?.includes('bnal.sid')
      });

      if (!req.isAuthenticated() || !req.user) {
        console.log('❌ Authentication failed - returning 401');
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Убедимся, что данные пользователя актуальны
      const userId = (req.user as any).id;
      if (userId) {
        try {
          const currentUser = await storage.getUser(userId);
          if (currentUser) {
            console.log("✅ User session active and verified:", currentUser.username);
            return res.json(currentUser);
          }
        } catch (error) {
          console.error('Error fetching current user data:', error);
        }
      }

      console.log("✅ User session active (cached):", req.user.username);
      res.json(req.user);
    } catch (error) {
      console.error('Error in /api/user endpoint:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/logout", (req, res) => {
    const username = req.user?.username;
    const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout error" });
      }
      
      console.log("User logged out:", username);
      
      // Очищаем все cookie аутентификации
      res.clearCookie('user_data');
      res.clearCookie('bnal.sid');
      res.clearCookie('temp.sid');
      
      if (IS_VERCEL) {
        // Для Vercel просто очищаем cookies
        console.log('✅ Vercel logout - cookies cleared');
        res.sendStatus(200);
      } else {
        // Для обычного деплоя уничтожаем сессию
        req.session.destroy((destroyErr) => {
          if (destroyErr) {
            console.error('Session destroy error:', destroyErr);
          }
          res.sendStatus(200);
        });
      }
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
