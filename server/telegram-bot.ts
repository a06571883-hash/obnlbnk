
import { Telegraf } from 'telegraf';

// Используем токен из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Использовать динамическую ссылку, определяемую из переменных окружения
const WEBAPP_URL = process.env.REPLIT_DEPLOYMENT_URL || 
                   process.env.REPLIT_SLUG && `https://${process.env.REPLIT_SLUG}.replit.dev/` || 
                   'https://5424a4c9-a9c3-4301-9bc5-90b750200100-00-1p7r8su6wsdmo.kirk.replit.dev/';

console.log('Используется WEBAPP_URL:', WEBAPP_URL);

if (!BOT_TOKEN) {
  console.error('КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не найден в переменных окружения');
  console.error('Добавьте токен бота в секреты Replit (Tools > Secrets)');
} else {
  console.log('Токен бота найден успешно');
}

// Создаем экземпляр бота
const bot = new Telegraf(BOT_TOKEN || '');

// Команда /start
bot.command('start', (ctx) => {
  try {
    console.log(`Пользователь ${ctx.from.id} (${ctx.from.username || 'без имени'}) запустил бота`);
    console.log('Отправка WebApp URL напрямую:', WEBAPP_URL);
    
    // Используем inline_keyboard для более надежного открытия WebApp
    return ctx.reply('Добро пожаловать в BNAL Bank!', {
      parse_mode: 'HTML',
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

// Запуск бота
export function startBot() {
  if (!BOT_TOKEN) {
    console.error('Невозможно запустить Telegram бот: отсутствует TELEGRAM_BOT_TOKEN');
    console.log('Пожалуйста, добавьте токен бота в переменные окружения (Secrets)');
    return;
  }

  console.log('Запуск Telegram бота...');
  console.log('WebApp URL:', WEBAPP_URL);
  console.log('Переменные окружения:');
  console.log('- REPLIT_DEPLOYMENT_URL:', process.env.REPLIT_DEPLOYMENT_URL);
  console.log('- REPLIT_SLUG:', process.env.REPLIT_SLUG);

  // Запускаем бота в режиме polling с проверкой ошибок
  bot.launch()
    .then(() => {
      console.log('Telegram бот успешно запущен');
      console.log('Имя бота:', bot.botInfo?.username);
      console.log('WebApp URL:', WEBAPP_URL);
    })
    .catch(error => {
      console.error('Не удалось запустить Telegram бот:', error);
      console.error('Проверьте правильность токена бота и доступ к API Telegram');
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
