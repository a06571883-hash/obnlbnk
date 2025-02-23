import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

const scryptAsync = promisify(scrypt);

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
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

export function setupAuth(app: Express) {
  // Генерация стабильного секрета для сессий
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
  console.log('Using session secret:', sessionSecret.substring(0, 8) + '...');

  // Настройка сессии с подробными параметрами
  const sessionConfig = {
    secret: sessionSecret,
    name: 'bnal.sid',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    proxy: true,
    rolling: true, // Обновляет сессию при каждом запросе
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
      path: '/'
    }
  };

  // Настройка прокси и сессии
  app.set('trust proxy', 1);
  app.use(session(sessionConfig));

  // Отладка сессии
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log('Session debug (pre-auth):', {
      sessionID: req.sessionID,
      cookie: req.session?.cookie,
      user: req.session?.passport?.user
    });
    next();
  });

  // Инициализация Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Стратегия локальной аутентификации
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      console.log('Attempting authentication for user:', username);
      const user = await storage.getUserByUsername(username);

      if (!user) {
        console.log('Authentication failed: User not found');
        return done(null, false, { message: "Пользователь не найден" });
      }

      const isValid = await comparePasswords(password, user.password);
      console.log('Password validation result:', isValid);

      if (!isValid) {
        return done(null, false, { message: "Неверный пароль" });
      }

      console.log('Authentication successful for user:', username);
      return done(null, user);
    } catch (error) {
      console.error('Authentication error:', error);
      return done(error);
    }
  }));

  passport.serializeUser((user: Express.User, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user:', id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log('Deserialization failed: User not found');
        return done(null, false);
      }
      console.log('User deserialized successfully');
      done(null, user);
    } catch (error) {
      console.error('Deserialization error:', error);
      done(error);
    }
  });

  // Маршрут аутентификации
  app.post("/api/login", (req, res, next) => {
    console.log('Login attempt:', req.body.username);

    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: { message: string } | undefined) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Ошибка сервера при входе" });
      }

      if (!user) {
        console.log('Login failed:', info?.message);
        return res.status(401).json({ message: info?.message || "Ошибка аутентификации" });
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error("Session error:", err);
          return res.status(500).json({ message: "Ошибка при создании сессии" });
        }
        console.log('Login successful for user:', user.username);
        res.json(user);
      });
    })(req, res, next);
  });

  // Маршрут проверки пользователя
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Необходима авторизация" });
    }
    res.json(req.user);
  });

  // Маршрут регистрации
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Необходимо указать имя пользователя и пароль" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким именем уже существует" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        is_regulator: false,
        regulator_balance: "0"
      });

      req.login(user, (err) => {
        if (err) {
          console.error("Registration session error:", err);
          return res.status(500).json({ message: "Ошибка при создании сессии" });
        }
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Ошибка при регистрации" });
    }
  });

  // Маршрут выхода
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Ошибка при выходе" });
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
        }
        res.clearCookie('bnal.sid');
        res.sendStatus(200);
      });
    });
  });

  // Защищенные API маршруты
  app.get("/api/cards", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }
      const cards = await storage.getCardsByUserId(req.user.id);
      res.json(cards);
    } catch (error) {
      console.error("Cards fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении карт" });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      const userCards = await storage.getCardsByUserId(req.user.id);
      const allTransactions = [];

      for (const card of userCards) {
        const cardTransactions = await storage.getTransactionsByCardId(card.id);
        allTransactions.push(...cardTransactions);
      }

      allTransactions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json(allTransactions);
    } catch (error) {
      console.error("Transactions fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении транзакций" });
    }
  });

  // Безопасность заголовков
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}