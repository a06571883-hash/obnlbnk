
import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { users, cards, transactions, exchangeRates } from '@shared/schema';

const BACKUP_DIR = path.join(process.cwd(), 'backup');

export async function exportDatabase() {
  try {
    // Создаем директорию для бэкапа если её нет
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    // Экспортируем данные из каждой таблицы
    const usersData = await db.select().from(users);
    const cardsData = await db.select().from(cards);
    const transactionsData = await db.select().from(transactions);
    const ratesData = await db.select().from(exchangeRates);
    
    // Сохраняем данные в JSON файлы
    await fs.writeFile(
      path.join(BACKUP_DIR, 'users.json'),
      JSON.stringify(usersData, null, 2)
    );
    await fs.writeFile(
      path.join(BACKUP_DIR, 'cards.json'),
      JSON.stringify(cardsData, null, 2)
    );
    await fs.writeFile(
      path.join(BACKUP_DIR, 'transactions.json'),
      JSON.stringify(transactionsData, null, 2)
    );
    await fs.writeFile(
      path.join(BACKUP_DIR, 'rates.json'),
      JSON.stringify(ratesData, null, 2)
    );
    
    console.log('Database backup completed successfully');
    return true;
  } catch (error) {
    console.error('Error during database backup:', error);
    return false;
  }
}

export async function importDatabase() {
  try {
    // Читаем данные из файлов
    const usersData = JSON.parse(
      await fs.readFile(path.join(BACKUP_DIR, 'users.json'), 'utf-8')
    );
    const cardsData = JSON.parse(
      await fs.readFile(path.join(BACKUP_DIR, 'cards.json'), 'utf-8')
    );
    const transactionsData = JSON.parse(
      await fs.readFile(path.join(BACKUP_DIR, 'transactions.json'), 'utf-8')
    );
    const ratesData = JSON.parse(
      await fs.readFile(path.join(BACKUP_DIR, 'rates.json'), 'utf-8')
    );

    // Импортируем данные в таблицы
    await db.insert(users).values(usersData);
    await db.insert(cards).values(cardsData);
    await db.insert(transactions).values(transactionsData);
    await db.insert(exchangeRates).values(ratesData);

    console.log('Database restore completed successfully');
    return true;
  } catch (error) {
    console.error('Error during database restore:', error);
    return false;
  }
}
