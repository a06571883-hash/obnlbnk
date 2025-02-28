import { Telegraf } from 'telegraf';

// Better error handling and token management
const BOT_TOKEN = '7464154474:AAGxQmjQAqrT1WuH4ksuhExRiAc6UWX1ak4';
const WEBAPP_URL = 'https://bnal-bank.webxcorporation.repl.co';

const bot = new Telegraf(BOT_TOKEN);

// Command handlers
bot.command('start', (ctx) => {
  try {
    return ctx.reply('Добро пожаловать в BNAL Bank!', {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Открыть приложение', web_app: { url: WEBAPP_URL } }
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

  // Launch bot in polling mode instead of webhook to avoid port conflict
  bot.launch()
    .then(() => {
      console.log('Telegram bot started successfully');

      // Set the WebApp button in the bot's menu
      return bot.telegram.setChatMenuButton({
        menuButton: {
          type: 'web_app',
          text: 'Open App',
          web_app: { url: WEBAPP_URL }
        }
      });
    })
    .then(() => {
      console.log('WebApp button set successfully');
    })
    .catch(error => {
      console.error('Failed to start Telegram bot:', error);
      throw error; // Re-throw to handle it in the main application
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}