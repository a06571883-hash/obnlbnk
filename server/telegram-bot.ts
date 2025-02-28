
import { Telegraf } from 'telegraf';

// Используем токен из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не найден в переменных окружения');
  // Продолжаем работу, но бот не запустится
}

// Используем конкретный URL для веб-приложения
const WEBAPP_URL = 'https://5424a4c9-a9c3-4301-9bc5-90b750200100-00-1p7r8su6wsdmo.kirk.replit.dev/';

// Выводим информацию об используемом URL
console.log('Используется фиксированный WebApp URL:', WEBAPP_URL);

console.log('Переменные окружения:', {
  REPLIT_DEPLOYMENT_URL: process.env.REPLIT_DEPLOYMENT_URL,
  REPLIT_SLUG: process.env.REPLIT_SLUG,
  REPLIT_OWNER: process.env.REPLIT_OWNER
});

const bot = new Telegraf(BOT_TOKEN || '');

// Command handlers
bot.command('start', (ctx) => {
  try {
    console.log('Отправка стартового сообщения с WebApp URL:', WEBAPP_URL);
    return ctx.reply('Добро пожаловать в BNAL Bank!', {
      reply_markup: {
        inline_keyboard: [[
          {
            text: 'Открыть BNAL Bank',
            web_app: { url: WEBAPP_URL }
          }
        ]]
      }
    });
  } catch (error) {
    console.error('Ошибка в команде start:', error);
    return ctx.reply('Извините, произошла ошибка. Попробуйте позже.');
  }
});

export function startBot() {
  if (!BOT_TOKEN) {
    console.error('Невозможно запустить Telegram бот: отсутствует TELEGRAM_BOT_TOKEN');
    console.log('Пожалуйста, добавьте токен бота в переменные окружения');
    return;
  }

  console.log('Запуск Telegram бота...');
  console.log('WebApp URL:', WEBAPP_URL);

  // Запускаем бота в режиме polling
  bot.launch()
    .then(() => {
      console.log('Telegram бот успешно запущен');
      console.log('Имя бота:', bot.botInfo?.username);
      console.log('Полный WebApp URL:', WEBAPP_URL);
    })
    .catch(error => {
      console.error('Не удалось запустить Telegram бот:', error);
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
