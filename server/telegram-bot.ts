
import { Telegraf } from 'telegraf';

// Используем токен из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Получаем URL из переменной окружения или используем закодированное значение
function getWebAppUrl() {
  // Используем URL из среды, если он существует
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return process.env.REPLIT_DEPLOYMENT_URL;
  }
  
  // Альтернативный вариант с slug и owner
  if (process.env.REPLIT_SLUG && process.env.REPLIT_OWNER) {
    return `https://${process.env.REPLIT_SLUG}.${process.env.REPLIT_OWNER}.repl.co`;
  }
  
  // Закодированный URL в случае, если другие варианты не работают
  return 'https://5424a4c9-a9c3-4301-9bc5-90b750200100.id.repl.co';
}

// Определяем URL веб-приложения
const WEBAPP_URL = getWebAppUrl();

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

// Запуск бота
export function startBot() {
  if (!BOT_TOKEN) {
    console.error('Невозможно запустить Telegram бот: отсутствует TELEGRAM_BOT_TOKEN');
    console.log('Пожалуйста, добавьте токен бота в переменные окружения (Secrets)');
    return;
  }

  console.log('Запуск Telegram бота...');
  console.log('WebApp URL:', WEBAPP_URL);

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
