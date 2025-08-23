// Простой запуск TypeScript сервера через различные методы
import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Попытка запуска TypeScript сервера...');

const tryCommands = [
  'node --loader=ts-node/esm server/index.ts',
  'node --loader=@babel/register server/index.ts', 
  'npx ts-node server/index.ts',
  './node_modules/.bin/tsx server/index.ts'
];

async function tryStart() {
  for (const cmd of tryCommands) {
    try {
      console.log(`Пробуем: ${cmd}`);
      const [command, ...args] = cmd.split(' ');
      const child = spawn(command, args, { 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' }
      });
      
      child.on('error', (error) => {
        console.log(`Ошибка с командой ${cmd}:`, error.message);
      });
      
      // Ждем немного чтобы увидеть результат
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (!child.killed) {
        console.log(`✅ Успешно запущен с: ${cmd}`);
        return child;
      }
    } catch (error) {
      console.log(`Не удалось: ${cmd}`, error.message);
    }
  }
  
  console.log('❌ Не удалось запустить ни одним способом');
  return null;
}

tryStart();