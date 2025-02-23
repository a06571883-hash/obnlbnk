import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
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
    // Handle plain text passwords during transition
    if (!stored.includes('.')) {
      return supplied === stored;
    }

    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    name: 'sid',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  };

  app.set('trust proxy', 1);
  app.use(session(sessionConfig));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        // Special handling for admin user
        if (username === 'admin' && password === 'admin123') {
          let user = await storage.getUserByUsername('admin');
          if (!user) {
            user = await storage.createUser({
              username: 'admin',
              password: await hashPassword('admin123'),
              is_regulator: true,
              regulator_balance: "1000000"
            });
          }
          return done(null, user);
        }

        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Пользователь не найден" });
        }

        const isValidPassword = await comparePasswords(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: "Неверный пароль" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Authentication routes
  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        return res.status(500).json({ message: "Ошибка сервера при входе" });
      }

      if (!user) {
        return res.status(401).json({ message: info?.message || "Ошибка аутентификации" });
      }

      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Ошибка при создании сессии" });
        }
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({
          message: "Пользователь с таким именем уже существует"
        });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        username: req.body.username,
        password: hashedPassword,
        is_regulator: false,
        regulator_balance: "0"
      });

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Ошибка при создании сессии" });
        }
        res.status(201).json(user);
      });
    } catch (error) {
      res.status(500).json({ message: "Ошибка при регистрации" });
    }
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Ошибка при выходе" });
      }
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    res.json(req.user);
  });

  // Add these routes back to routes.ts
  app.get("/api/cards", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }
      const cards = await storage.getCardsByUserId(req.user.id);
      res.json(cards);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при получении карт" });
    }
  });

  app.get("/api/transactions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      const userCards = await storage.getCardsByUserId(req.user.id);
      let allTransactions = [];

      for (const card of userCards) {
        const cardTransactions = await storage.getTransactionsByCardId(card.id);
        allTransactions = [...allTransactions, ...cardTransactions];
      }

      allTransactions.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json(allTransactions);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при получении транзакций" });
    }
  });
}