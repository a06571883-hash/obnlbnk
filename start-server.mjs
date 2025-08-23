import { execSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Запуск сервера...');

// Попробуем разные способы запуска
const commands = [
  'npx tsx server/index.ts',
  'node --loader tsx/esm server/index.ts', 
  'node server/index.js'
];

for (const cmd of commands) {
  try {
    console.log(`Пробуем: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: __dirname });
    break;
  } catch (error) {
    console.log(`Не удалось запустить: ${cmd}`);
    console.error(error.message);
  }
}