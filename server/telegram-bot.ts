import { Telegraf, Markup } from 'telegraf';
import { storage } from './storage';
import { Message } from 'telegraf/types';
import { createExchangeTransaction, getExchangeRate } from './exchange-service';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '8096961454:AAEmX7kc1Tus12F7uDA06SkJs8pAVo2MmIs');

// Команда /start
bot.command('start', (ctx) => {
  ctx.reply(
    'Добро пожаловать в BNAL Bank!',
    Markup.keyboard([
      [Markup.button.webApp('🏦 Открыть BNAL Bank', process.env.REPLIT_DEPLOYMENT_URL || 'https://bnal-bank.webxcorporation.repl.co')]
    ]).resize()
  );
});

export function startBot() {
  bot.launch()
    .then(() => {
      console.log('Telegram bot started successfully');
      console.log('WebApp URL:', process.env.REPLIT_DEPLOYMENT_URL || 'https://bnal-bank.webxcorporation.repl.co');
    })
    .catch(error => {
      console.error('Failed to start Telegram bot:', error);
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}