import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('viewer.db');

// Добавляем тестового пользователя
const salt = bcrypt.genSaltSync(10);
const passwordHash = bcrypt.hashSync('test123', salt);

db.prepare(`
  INSERT INTO users (username, password_hash)
  VALUES (?, ?)
`).run('testuser', passwordHash);

// Получаем ID созданного пользователя
const user = db.prepare('SELECT id FROM users WHERE username = ?').get('testuser');

// Добавляем тестовые криптовалютные адреса
const addresses = [
  {
    type: 'BTC',
    address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    label: 'Bitcoin Genesis Address'
  },
  {
    type: 'ETH',
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    label: 'Ethereum Test Address'
  }
];

const insertAddress = db.prepare(`
  INSERT INTO crypto_addresses (user_id, type, address, label)
  VALUES (?, ?, ?, ?)
`);

for (const addr of addresses) {
  insertAddress.run(user.id, addr.type, addr.address, addr.label);
}

console.log('Тестовые данные успешно добавлены');
db.close();
