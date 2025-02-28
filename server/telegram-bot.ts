import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '7464154474:AAGxQmjQAqrT1WuH4ksuhExRiAc6UWX1ak4');

// Команда /start
bot.command('start', (ctx) => {
  ctx.reply(
    'Добро пожаловать в BNAL Bank!'
  );
});

export function startBot() {
  bot.launch()
    .then(() => {
      console.log('Telegram bot started successfully');
      console.log('WebApp URL:', 'https://5424a4c9-a9c3-4301-9bc5-90b750200100-00-1p7r8su6wsdmo.kirk.replit.dev/');

      // Set the WebApp button in the bot's menu
      bot.telegram.setChatMenuButton({
        chatId: undefined,
        menuButton: {
          type: 'web_app',
          text: 'Open App',
          web_app: {
            url: 'https://5424a4c9-a9c3-4301-9bc5-90b750200100-00-1p7r8su6wsdmo.kirk.replit.dev/'
          }
        }
      });
    })
    .catch(error => {
      console.error('Failed to start Telegram bot:', error);
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}