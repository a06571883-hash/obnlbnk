/**
 * Контроллер для информации о NFT сервере
 * Предоставляет информацию о состоянии NFT сервера и доступных изображениях
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
// Создаем роутер
const router = express.Router();
// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Порт NFT сервера (читаем из файла конфигурации)
const NFT_SERVER_PORT_FILE = path.join(process.cwd(), 'nft-server-port.txt');
let NFT_SERVER_PORT = 8081; // По умолчанию
// Директории с изображениями NFT
const DIRECTORIES = {
    'bored_ape_nft': path.join(process.cwd(), 'bored_ape_nft'),
    'mutant_ape_nft': path.join(process.cwd(), 'mutant_ape_nft'),
    'mutant_ape_official': path.join(process.cwd(), 'mutant_ape_official'),
    'nft_assets/mutant_ape': path.join(process.cwd(), 'nft_assets', 'mutant_ape')
};
// Читаем порт из файла при запуске сервера
function readNFTServerPort() {
    // Читаем порт из файла, если он существует
    if (fs.existsSync(NFT_SERVER_PORT_FILE)) {
        try {
            const portStr = fs.readFileSync(NFT_SERVER_PORT_FILE, 'utf8').trim();
            const port = parseInt(portStr, 10);
            if (!isNaN(port) && port > 1024 && port < 65535) {
                NFT_SERVER_PORT = port;
                console.log(`NFT Server Controller: Загружен порт NFT сервера из файла: ${NFT_SERVER_PORT}`);
            }
            else {
                console.log(`NFT Server Controller: Некорректный порт в файле: ${portStr}, используем порт по умолчанию: ${NFT_SERVER_PORT}`);
            }
        }
        catch (err) {
            console.error(`NFT Server Controller: Ошибка при чтении порта из файла: ${err.message}`);
        }
    }
    else {
        console.log(`NFT Server Controller: Файл с портом не найден, используем порт по умолчанию: ${NFT_SERVER_PORT}`);
    }
    return NFT_SERVER_PORT;
}
// Проверяем доступность NFT сервера
function checkServerAvailability() {
    const port = readNFTServerPort();
    console.log(`NFT Server Controller: Проверка доступности NFT сервера на порту ${port}...`);
    return new Promise((resolve) => {
        const req = http.request({
            host: 'localhost',
            port: port,
            path: '/status',
            method: 'GET',
            timeout: 3000
        }, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
        req.on('error', () => {
            resolve(false);
        });
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        req.end();
    });
}
// Проверяем наличие файлов в директориях
function checkDirectories() {
    console.log(`NFT Server Controller: Проверка директорий с изображениями NFT...`);
    const stats = {};
    for (const [dirName, dirPath] of Object.entries(DIRECTORIES)) {
        if (fs.existsSync(dirPath)) {
            try {
                const files = fs.readdirSync(dirPath);
                const pngFiles = files.filter(f => f.endsWith('.png'));
                const svgFiles = files.filter(f => f.endsWith('.svg'));
                stats[dirName] = {
                    total: files.length,
                    png: pngFiles.length,
                    svg: svgFiles.length
                };
            }
            catch (err) {
                stats[dirName] = { error: err.message };
            }
        }
        else {
            stats[dirName] = { error: 'Directory not found' };
        }
    }
    return stats;
}
// Маршрут для проверки статуса NFT сервера
router.get('/server-status', async (req, res) => {
    try {
        const port = readNFTServerPort();
        const isAvailable = await checkServerAvailability();
        const directories = checkDirectories();
        res.json({
            available: isAvailable,
            port: port,
            timestamp: new Date().toISOString(),
            directories: directories
        });
    }
    catch (error) {
        console.error('Error checking NFT server status:', error);
        res.status(500).json({ error: 'Failed to check NFT server status' });
    }
});
export default router;
