import { Telegraf } from 'telegraf';

// Better error handling and token management
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7464154474:AAGxQmjQAqrT1WuH4ksuhExRiAc6UWX1ak4';

// Используем URL из окружения или конструируем из REPLIT_SLUG
const WEBAPP_URL = process.env.REPLIT_DEPLOYMENT_URL 
  ? process.env.REPLIT_DEPLOYMENT_URL 
  : process.env.REPLIT_SLUG 
    ? `https://${process.env.REPLIT_SLUG}.replit.dev`
    : 'https://bnal-bank.webxcorporation.repl.co';

const bot = new Telegraf(BOT_TOKEN);

// Command handlers
bot.command('start', (ctx) => {
  try {
    console.log('Sending start message with WebApp URL:', WEBAPP_URL);
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
    console.error('Error in start command:', error);
    return ctx.reply('Извините, произошла ошибка. Попробуйте позже.');
  }
});

export function startBot() {
  console.log('Starting Telegram bot...');
  console.log('WebApp URL:', WEBAPP_URL);

  // Запускаем бота в режиме polling
  bot.launch()
    .then(() => {
      console.log('Telegram bot started successfully');
      console.log('Bot username:', bot.botInfo?.username);
      console.log('Full WebApp URL being used:', WEBAPP_URL);
    })
    .catch(error => {
      console.error('Failed to start Telegram bot:', error);
      throw error;
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}