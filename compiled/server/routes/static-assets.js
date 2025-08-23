import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const staticAssetsRouter = Router();
/**
 * Прямой метод обработки файла, который будет использоваться нашим роутером
 * и может быть также вызван как utility-функция
 */
export async function serveImageFile(req, res, next) {
    // Логика определения пути к файлу
    let filePath;
    let filename;
    // Определяем пути из параметров запроса или URL
    if (req.params.filename) {
        // Если маршрут был вида /path/:filename
        filename = req.params.filename;
        if (req.path.startsWith('/bayc_official/')) {
            filePath = path.join(process.cwd(), 'public', 'bayc_official', filename);
        }
        else {
            filePath = path.join(process.cwd(), 'public', filename);
        }
    }
    else {
        // Если запрос был на прямой путь
        const urlPath = req.path;
        if (urlPath.startsWith('/bayc_official/')) {
            const filenamePart = urlPath.replace('/bayc_official/', '');
            filePath = path.join(process.cwd(), 'public', 'bayc_official', filenamePart);
        }
        else {
            // Общий случай
            filePath = path.join(process.cwd(), 'public', urlPath);
        }
    }
    console.log(`Debugging static file request: ${req.path} -> ${filePath}`);
    // Проверяем существование файла
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            console.log(`Not a file: ${filePath}`);
            return next();
        }
    }
    catch (err) {
        console.log(`File not found: ${filePath}`);
        return next();
    }
    // Определяем MIME-тип на основе расширения файла
    let contentType = 'application/octet-stream'; // По умолчанию
    if (filePath.endsWith('.png')) {
        contentType = 'image/png';
    }
    else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
    }
    else if (filePath.endsWith('.avif')) {
        contentType = 'image/avif';
    }
    console.log(`Serving file: ${filePath} with content-type: ${contentType}`);
    // Устанавливаем MIME-тип и отправляем файл
    res.setHeader('Content-Type', contentType);
    // Включаем кеширование
    res.setHeader('Cache-Control', 'public, max-age=86400'); // кеширование на 1 день
    // Используем res.sendFile для более надежной отправки файла с правильными заголовками
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error sending file: ${filePath}`, err);
            if (!res.headersSent) {
                return next(err);
            }
        }
    });
}
/**
 * Специальный роутер для обработки статических изображений NFT
 * с корректной установкой MIME-типов
 */
staticAssetsRouter.get('/bayc_official/:filename', (req, res, next) => {
    // Перенаправляем запрос через наш прокси на порт 8080
    const proxyPath = `/nft-proxy/bayc_official/${req.params.filename}`;
    console.log(`Redirecting NFT image request to proxy: ${req.path} -> ${proxyPath}`);
    res.redirect(proxyPath);
});
// Дополнительный обработчик для полного пути BAYC
staticAssetsRouter.get('/bayc_official/*', (req, res, next) => {
    // Извлекаем полный путь после /bayc_official/
    const filePath = req.path;
    const proxyPath = `/nft-proxy${filePath}`;
    console.log(`Redirecting NFT image request to proxy: ${req.path} -> ${proxyPath}`);
    res.redirect(proxyPath);
});
// Обработчик для Mutant Ape изображений
staticAssetsRouter.get('/mutant_ape_nft/:filename', (req, res, next) => {
    // Перенаправляем запрос через наш прокси на порт 8080
    const proxyPath = `/nft-proxy/mutant_ape_nft/${req.params.filename}`;
    console.log(`Redirecting Mutant Ape image request to proxy: ${req.path} -> ${proxyPath}`);
    res.redirect(proxyPath);
});
// Общий обработчик для Mutant Ape директории
staticAssetsRouter.get('/mutant_ape_nft/*', (req, res, next) => {
    // Извлекаем полный путь после /mutant_ape_nft/
    const filePath = req.path;
    const proxyPath = `/nft-proxy${filePath}`;
    console.log(`Redirecting Mutant Ape image request to proxy: ${req.path} -> ${proxyPath}`);
    res.redirect(proxyPath);
});
