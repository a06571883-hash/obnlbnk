import { Telegraf, Markup } from 'telegraf';
import { storage } from './storage';
import { Message } from 'telegraf/types';
import { createExchangeTransaction, getExchangeRate } from './exchange-service';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '8096961454:AAEmX7kc1Tus12F7uDA06SkJs8pAVo2MmIs');

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
      console.log('WebApp URL:', 'https://2cb62bd7-0d31-4cbf-8273-4036756a20a5-00-3fwf6u41ptm73.spock.replit.dev');

      // Set the WebApp button in the bot's menu
      bot.telegram.setChatMenuButton({
        menuButton: {
          type: 'web_app',
          text: 'Open App',
          web_app: {
            url: 'https://2cb62bd7-0d31-4cbf-8273-4036756a20a5-00-3fwf6u41ptm73.spock.replit.dev'
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