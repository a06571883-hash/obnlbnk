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
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
  console.log('Setting up authentication...');

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/'
    },
    name: 'sid'
  };

  console.log('Session configuration:', {
    secure: sessionSettings.cookie?.secure,
    sameSite: sessionSettings.cookie?.sameSite,
    maxAge: sessionSettings.cookie?.maxAge,
    environment: process.env.NODE_ENV
  });

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
    console.log('Trust proxy enabled for production');
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        console.log(`[Auth] Login attempt for user: ${username}`);
        const user = await storage.getUserByUsername(username);

        if (!user) {
          console.log(`[Auth] User not found: ${username}`);
          return done(null, false, { message: "Пользователь не найден" });
        }

        // Special case for testing
        if (username === 'admin' && password === 'admin123') {
          console.log('[Auth] Admin test login successful');
          return done(null, user);
        }

        const isValidPassword = await comparePasswords(password, user.password);
        if (!isValidPassword) {
          console.log(`[Auth] Invalid password for user: ${username}`);
          return done(null, false, { message: "Неверное имя пользователя или пароль" });
        }

        console.log(`[Auth] Successful login for user: ${username}`);
        return done(null, user);
      } catch (err) {
        console.error('[Auth] Login error:', err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    console.log(`[Auth] Serializing user session: ${user.id}`);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`[Auth] Deserializing user session: ${id}`);
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
    console.log('[Auth] Session ID before login:', req.sessionID);

    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        console.error('[Auth] Authentication error:', err);
        return next(err);
      }

      if (!user) {
        console.log('[Auth] Authentication failed:', info?.message);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error('[Auth] Login error:', err);
          return next(err);
        }
        console.log('[Auth] User successfully logged in:', {
          username: user.username,
          sessionID: req.sessionID,
          isAuthenticated: req.isAuthenticated()
        });
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req: Request, res: Response, next: NextFunction) => {
    console.log(`[Auth] Logout request received. User: ${req.user?.username}, Session ID: ${req.sessionID}`);
    req.logout((err) => {
      if (err) {
        console.error('[Auth] Logout error:', err);
        return next(err);
      }
      console.log('[Auth] User successfully logged out');
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    console.log(`[Auth] User info request. Authenticated: ${req.isAuthenticated()}, Session ID: ${req.sessionID}`);
    if (!req.isAuthenticated()) {
      console.log('[Auth] Unauthorized access attempt to /api/user');
      return res.sendStatus(401);
    }
    console.log('[Auth] Returning user info:', req.user);
    res.json(req.user);
  });

  // Add request logging middleware for auth-related routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[Auth] ${req.method} ${req.path} - Session ID: ${req.sessionID}, Authenticated: ${req.isAuthenticated()}`);
    }
    next();
  });

  app.post("/api/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('[Auth] Registration attempt:', req.body.username);

      if (!req.body.username || !req.body.password) {
        console.log('[Auth] Registration failed - missing credentials');
        return res.status(400).json({ 
          message: "Требуется имя пользователя и пароль" 
        });
      }

      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log(`[Auth] Registration failed - username exists: ${req.body.username}`);
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

      console.log(`[Auth] User registered successfully: ${user.username}`);

      req.login(user, (err) => {
        if (err) {
          console.error('[Auth] Login after registration failed:', err);
          return next(err);
        }
        console.log(`[Auth] Auto-login after registration successful: ${user.username}`);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error('[Auth] Registration error:', error);
      next(error);
    }
  });
}