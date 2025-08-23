import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { users, cards, transactions, exchangeRates } from '@shared/schema';
import JSZip from 'jszip';
const BACKUP_DIR = path.join(process.cwd(), 'backup');
const ZIP_DIR = path.join(process.cwd(), 'backup/zip');
const SQL_DIR = path.join(process.cwd(), 'backup/sql');
// Создаем все необходимые директории
async function ensureDirectories() {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    await fs.mkdir(ZIP_DIR, { recursive: true });
    await fs.mkdir(SQL_DIR, { recursive: true });
}
export async function exportDatabase() {
    try {
        await ensureDirectories();
        // Получаем данные из всех таблиц
        const usersData = await db.select().from(users);
        const cardsData = await db.select().from(cards);
        const transactionsData = await db.select().from(transactions);
        const ratesData = await db.select().from(exchangeRates);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        // Сохраняем в JSON
        const jsonData = {
            users: usersData,
            cards: cardsData,
            transactions: transactionsData,
            rates: ratesData,
            backupDate: timestamp,
            version: '1.0'
        };
        // Сохраняем в отдельные JSON файлы
        await fs.writeFile(path.join(BACKUP_DIR, 'users.json'), JSON.stringify(usersData, null, 2));
        await fs.writeFile(path.join(BACKUP_DIR, 'cards.json'), JSON.stringify(cardsData, null, 2));
        await fs.writeFile(path.join(BACKUP_DIR, 'transactions.json'), JSON.stringify(transactionsData, null, 2));
        await fs.writeFile(path.join(BACKUP_DIR, 'rates.json'), JSON.stringify(ratesData, null, 2));
        // Создаем ZIP архив
        const zip = new JSZip();
        zip.file('backup.json', JSON.stringify(jsonData, null, 2));
        // Добавляем отдельные файлы в zip
        zip.file('users.json', JSON.stringify(usersData, null, 2));
        zip.file('cards.json', JSON.stringify(cardsData, null, 2));
        zip.file('transactions.json', JSON.stringify(transactionsData, null, 2));
        zip.file('rates.json', JSON.stringify(ratesData, null, 2));
        // Генерируем SQL дамп
        let sqlDump = '';
        // SQL для users
        sqlDump += 'INSERT INTO users (id, username, password, is_regulator, regulator_balance, last_nft_generation, nft_generation_count) VALUES\n';
        sqlDump += usersData.map(user => `(${user.id}, '${user.username}', '${user.password}', ${user.is_regulator}, ${user.regulator_balance}, ${user.last_nft_generation ? `'${user.last_nft_generation}'` : 'NULL'}, ${user.nft_generation_count})`).join(',\n') + ';\n\n';
        // SQL для cards
        sqlDump += 'INSERT INTO cards (id, user_id, type, number, expiry, cvv, balance, btc_balance, eth_balance, btc_address, eth_address) VALUES\n';
        sqlDump += cardsData.map(card => `(${card.id}, ${card.userId}, '${card.type}', '${card.number}', '${card.expiry}', '${card.cvv}', ${card.balance}, ${card.btcBalance}, ${card.ethBalance}, ${card.btcAddress ? `'${card.btcAddress}'` : 'NULL'}, ${card.ethAddress ? `'${card.ethAddress}'` : 'NULL'})`).join(',\n') + ';\n\n';
        // SQL для transactions
        sqlDump += 'INSERT INTO transactions (id, from_card_id, to_card_id, amount, converted_amount, type, wallet, status, created_at, description, from_card_number, to_card_number) VALUES\n';
        sqlDump += transactionsData.map(tx => {
            // Проверка и безопасное форматирование даты
            let createdAtSql = 'NULL';
            if (tx.createdAt) {
                try {
                    // Преобразуем строковую дату в объект Date если это строка
                    const dateObj = typeof tx.createdAt === 'string' ? new Date(tx.createdAt) : tx.createdAt;
                    createdAtSql = `'${dateObj.toISOString()}'`;
                }
                catch (e) {
                    createdAtSql = "'2025-01-01'"; // Запасная дата если форматирование не удалось
                }
            }
            return `(${tx.id}, ${tx.fromCardId}, ${tx.toCardId || 'NULL'}, ${tx.amount}, ${tx.convertedAmount || 'NULL'}, '${tx.type}', ${tx.wallet ? `'${tx.wallet}'` : 'NULL'}, '${tx.status}', ${createdAtSql}, '${tx.description.replace(/'/g, "''")}', '${tx.fromCardNumber}', ${tx.toCardNumber ? `'${tx.toCardNumber}'` : 'NULL'})`;
        }).join(',\n') + ';\n\n';
        // SQL для exchange_rates
        sqlDump += 'INSERT INTO exchange_rates (id, usd_to_uah, btc_to_usd, eth_to_usd, updated_at) VALUES\n';
        sqlDump += ratesData.map(rate => {
            // Проверка и безопасное форматирование даты
            let updatedAtSql = 'NULL';
            if (rate.updatedAt) {
                try {
                    // Преобразуем строковую дату в объект Date если это строка
                    const dateObj = typeof rate.updatedAt === 'string' ? new Date(rate.updatedAt) : rate.updatedAt;
                    updatedAtSql = `'${dateObj.toISOString()}'`;
                }
                catch (e) {
                    updatedAtSql = "'2025-01-01'"; // Запасная дата если форматирование не удалось
                }
            }
            return `(${rate.id}, ${rate.usdToUah}, ${rate.btcToUsd}, ${rate.ethToUsd}, ${updatedAtSql})`;
        }).join(',\n') + ';\n';
        // Сохраняем SQL дамп
        const sqlFileName = `backup_${timestamp}.sql`;
        await fs.writeFile(path.join(SQL_DIR, sqlFileName), sqlDump);
        // Сохраняем ZIP архив
        const zipFileName = `backup_${timestamp}.zip`;
        const zipContent = await zip.generateAsync({ type: "nodebuffer" });
        await fs.writeFile(path.join(ZIP_DIR, zipFileName), zipContent);
        console.log('Database backup completed successfully');
        console.log('Backup files created:');
        console.log(`- JSON files in ${BACKUP_DIR}`);
        console.log(`- ZIP archive: ${path.join(ZIP_DIR, zipFileName)}`);
        console.log(`- SQL dump: ${path.join(SQL_DIR, sqlFileName)}`);
        return {
            success: true,
            files: {
                json: path.join(BACKUP_DIR, 'backup.json'),
                zip: path.join(ZIP_DIR, zipFileName),
                sql: path.join(SQL_DIR, sqlFileName)
            }
        };
    }
    catch (error) {
        console.error('Error during database backup:', error);
        return { success: false, error };
    }
}
export async function importDatabase() {
    try {
        // Читаем данные из файлов
        const usersData = JSON.parse(await fs.readFile(path.join(BACKUP_DIR, 'users.json'), 'utf-8'));
        const cardsData = JSON.parse(await fs.readFile(path.join(BACKUP_DIR, 'cards.json'), 'utf-8'));
        const transactionsData = JSON.parse(await fs.readFile(path.join(BACKUP_DIR, 'transactions.json'), 'utf-8'));
        const ratesData = JSON.parse(await fs.readFile(path.join(BACKUP_DIR, 'rates.json'), 'utf-8'));
        // Импортируем данные в таблицы с использованием onConflictDoNothing
        await db.insert(users).values(usersData).onConflictDoNothing();
        await db.insert(cards).values(cardsData).onConflictDoNothing();
        await db.insert(transactions).values(transactionsData).onConflictDoNothing();
        await db.insert(exchangeRates).values(ratesData).onConflictDoNothing();
        console.log('Database restore completed successfully');
        return true;
    }
    catch (error) {
        console.error('Error during database restore:', error);
        return false;
    }
}
// Автоматическое создание бэкапа каждые 24 часа
export function scheduleBackups() {
    const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 часа
    // Создаем первый бэкап при запуске
    exportDatabase().catch(console.error);
    // Планируем регулярные бэкапы
    setInterval(async () => {
        console.log('Starting scheduled backup...');
        try {
            const result = await exportDatabase();
            if (result.success) {
                console.log('Scheduled backup completed successfully');
                // Удаляем старые бэкапы (оставляем только последние 7)
                const cleanupDirectories = async (dir, extension) => {
                    const files = await fs.readdir(dir);
                    const backupFiles = files
                        .filter(file => file.endsWith(extension))
                        .sort((a, b) => b.localeCompare(a)); // Сортируем по убыванию (новые первые)
                    // Удаляем все файлы, кроме последних 7
                    for (const file of backupFiles.slice(7)) {
                        await fs.unlink(path.join(dir, file));
                    }
                };
                await cleanupDirectories(SQL_DIR, '.sql');
                await cleanupDirectories(ZIP_DIR, '.zip');
            }
            else {
                console.error('Scheduled backup failed:', result.error);
            }
        }
        catch (error) {
            console.error('Error during scheduled backup:', error);
        }
    }, BACKUP_INTERVAL);
}
