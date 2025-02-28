
import { Telegraf } from 'telegraf';

// Используем токен из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не найден в переменных окружения');
  // Продолжаем работу, но бот не запустится
}

// Более надежное определение URL
const getWebAppUrl = () => {
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return process.env.REPLIT_DEPLOYMENT_URL;
  }
  
  if (process.env.REPLIT_SLUG) {
    return `https://${process.env.REPLIT_SLUG}.replit.dev`;
  }
  
  // Получаем URL для разработки, используя домен Replit
  return `https://${process.env.REPLIT_OWNER}-${process.env.REPLIT_SLUG}.replit.dev`;
};

const WEBAPP_URL = getWebAppUrl();

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
