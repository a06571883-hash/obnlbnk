/**
 * Упрощенный сервер для быстрого запуска приложения
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статические файлы
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use(express.static(path.join(__dirname, 'client/dist')));

// Простейшие API маршруты для проверки работы
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Сервер работает',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Тестовый эндпоинт работает',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Fallback для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Упрощенный сервер запущен на порту ${PORT}`);
  console.log(`📱 Фронтенд доступен по адресу: http://localhost:${PORT}`);
  console.log(`🔌 API доступен по адресу: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Сервер привязан к 0.0.0.0 для внешнего доступа`);
});

export default app;