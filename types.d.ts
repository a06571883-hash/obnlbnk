// Объявления типов для библиотек без встроенных типов

declare module 'better-sqlite3' {
  type Database = any;
  export default function(path: string): Database;
}

declare module 'better-sqlite3-session-store' {
  import * as expressSession from 'express-session';
  import { Database } from 'better-sqlite3';
  
  export default function(session: any): {
    new (options: { client: any, expired?: { clear: boolean, intervalMs: number } }): expressSession.Store
  }
}

// Расширяем типы express-session для поддержки user в session
declare module 'express-session' {
  interface SessionData {
    user: string;     // Имя пользователя
    userId?: number;  // ID пользователя
    isAdmin?: boolean; // Флаг администратора
  }
}