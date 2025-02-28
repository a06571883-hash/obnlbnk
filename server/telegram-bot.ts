import { Telegraf } from 'telegraf';

const bot = new Telegraf('7464154474:AAGxQmjQAqrT1WuH4ksuhExRiAc6UWX1ak4');

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
      console.log('WebApp URL:', 'https://bnal-bank.webxcorporation.repl.co');

      // Set the WebApp button in the bot's menu
      bot.telegram.setChatMenuButton({
        chatId: undefined,
        menuButton: {
          type: 'web_app',
          text: 'Open App',
          web_app: {
            url: 'https://bnal-bank.webxcorporation.repl.co'
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