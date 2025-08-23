import type { Express } from "express";
import path from "path";
import express from "express";

/**
 * Настройка обслуживания статических файлов для production (Vercel)
 */
export function serveStatic(app: Express): void {
  console.log("🗂️ Настройка обслуживания статических файлов для Vercel...");

  // Обслуживание собранного фронтенда
  const distPath = path.resolve(process.cwd(), "dist", "public");
  console.log(`📁 Путь к статическим файлам: ${distPath}`);

  // Основные статические файлы
  app.use(express.static(distPath, {
    maxAge: '1y', // Кэш на год для статических ресурсов
    etag: true,
    lastModified: true
  }));

  // NFT изображения - обслуживаем напрямую из папок проекта
  app.use('/bored_ape_nft', express.static(path.join(process.cwd(), 'bored_ape_nft'), {
    maxAge: '1d', // Кэш на день для NFT изображений
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.avif')) {
        res.setHeader('Content-Type', 'image/avif');
      }
    }
  }));

  app.use('/public/assets/nft', express.static(path.join(process.cwd(), 'client/public/assets/nft'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.avif')) {
        res.setHeader('Content-Type', 'image/avif');
      }
    }
  }));

  app.use('/bayc_official', express.static(path.join(process.cwd(), 'client/public/bayc_official'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.avif')) {
        res.setHeader('Content-Type', 'image/avif');
      }
    }
  }));

  // Fallback для SPA роутинга - все неопределенные маршруты возвращают index.html
  app.get("*", (req, res) => {
    // Исключаем API маршруты
    if (req.path.startsWith('/api/') || req.path.startsWith('/webhook/')) {
      return res.status(404).json({ error: 'Not found' });
    }

    const indexPath = path.join(distPath, "index.html");
    console.log(`📄 Возвращаем index.html для SPA роутинга: ${req.path}`);
    res.sendFile(indexPath);
  });

  console.log("✅ Статические файлы настроены для Vercel");
}