import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { users } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
      console.log('[Auth] Using legacy password comparison');
      return supplied === stored;
    }

    console.log('[Auth] Using secure password comparison');
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('[Auth] Error comparing passwords:', error);
    return false;
  }
}

export function setupAuth(app: Express) {
  console.log('Setting up authentication...');

  // Initialize session middleware with proper settings
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    name: 'sid',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    proxy: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
      httpOnly: true
    }
  }));

  // Initialize Passport after session
  app.use(passport.initialize());
  app.use(passport.session());

  // Add session debugging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log('Session debug:', {
      sessionID: req.sessionID,
      session: req.session,
      isAuthenticated: req.isAuthenticated(),
      user: req.user,
      cookies: req.headers.cookie,
      method: req.method,
      path: req.path
    });
    next();
  });

  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        console.log(`[Auth] Login attempt for user: ${username}`);

        // Special handling for admin user
        if (username === 'admin' && password === 'admin123') {
          console.log('[Auth] Admin login attempt');
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

        // Regular user login
        const user = await storage.getUserByUsername(username);
        if (!user) {
          console.log(`[Auth] User not found: ${username}`);
          return done(null, false, { message: "Пользователь не найден" });
        }

        const isValidPassword = await comparePasswords(password, user.password);
        if (!isValidPassword) {
          console.log(`[Auth] Invalid password for user: ${username}`);
          return done(null, false, { message: "Неверный пароль" });
        }

        console.log(`[Auth] Successful login for user: ${username}`);
        return done(null, user);
      } catch (err) {
        console.error('[Auth] Login error:', err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    console.log(`[Auth] Serializing user: ${user.username} (${user.id})`);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`[Auth] Deserializing user: ${id}`);
      const user = await storage.getUser(id);
      if (!user) {
        console.log(`[Auth] User not found during deserialization: ${id}`);
        return done(null, false);
      }
      console.log(`[Auth] Successfully deserialized user: ${user.username}`);
      done(null, user);
    } catch (err) {
      console.error('[Auth] Deserialization error:', err);
      done(err);
    }
  });

  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    console.log('[Auth] Login request received:', req.body.username);

    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        console.error('[Auth] Authentication error:', err);
        return res.status(500).json({ message: "Ошибка сервера при входе" });
      }

      if (!user) {
        console.log('[Auth] Authentication failed:', info?.message);
        return res.status(401).json({ message: info?.message || "Ошибка аутентификации" });
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error('[Auth] Login error:', err);
          return res.status(500).json({ message: "Ошибка при создании сессии" });
        }

        console.log('[Auth] User successfully logged in:', {
          username: user.username,
          sessionID: req.sessionID
        });

        // Save session before sending response
        req.session.save((err) => {
          if (err) {
            console.error('[Auth] Session save error:', err);
            return res.status(500).json({ message: "Ошибка при сохранении сессии" });
          }
          res.json(user);
        });
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      console.log('[Auth] Registration attempt:', req.body.username);

      if (!req.body.username || !req.body.password) {
        return res.status(400).json({
          message: "Требуется имя пользователя и пароль"
        });
      }

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
          console.error('[Auth] Login after registration failed:', err);
          return res.status(500).json({ message: "Ошибка при создании сессии" });
        }

        // Save session before sending response
        req.session.save((err) => {
          if (err) {
            console.error('[Auth] Session save error:', err);
            return res.status(500).json({ message: "Ошибка при сохранении сессии" });
          }
          res.status(201).json(user);
        });
      });
    } catch (error) {
      console.error('[Auth] Registration error:', error);
      res.status(500).json({ message: "Ошибка при регистрации" });
    }
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    console.log(`[Auth] Logout request received. User: ${req.user?.username}`);

    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Вы не авторизованы" });
    }

    req.logout((err) => {
      if (err) {
        console.error('[Auth] Logout error:', err);
        return res.status(500).json({ message: "Ошибка при выходе" });
      }

      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth] Session destruction error:', err);
          return res.status(500).json({ message: "Ошибка при удалении сессии" });
        }
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    console.log(`[Auth] User info request. Authenticated: ${req.isAuthenticated()}`);

    if (!req.isAuthenticated()) {
      console.log('[Auth] Unauthorized access attempt to /api/user');
      return res.sendStatus(401);
    }

    if (!req.user) {
      console.log('[Auth] No user in session');
      return res.sendStatus(401);
    }

    console.log('[Auth] Returning user info:', req.user);
    res.json(req.user);
  });
}