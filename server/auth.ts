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
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
  console.log('Using session secret:', sessionSecret.substring(0, 8) + '...');

  const sessionConfig: session.SessionOptions = {
    secret: sessionSecret,
    name: 'bnal.sid',
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    cookie: {
      secure: false, // Set to false for development
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  };

  app.use(session(sessionConfig));
  app.use(passport.initialize());
  app.use(passport.session());

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

  app.get("/api/user", (req, res) => {
    console.log('User check:', req.isAuthenticated(), req.user);
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Необходима авторизация" });
    }
    res.json(req.user);
  });

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

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}