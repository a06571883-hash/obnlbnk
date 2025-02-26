import { Telegraf, Markup } from 'telegraf';
import { storage } from './storage';
import { Message } from 'telegraf/types';
import { createExchangeTransaction, getExchangeRate } from './exchange-service';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '8096961454:AAEmX7kc1Tus12F7uDA06SkJs8pAVo2MmIs');

// Session storage for user states
const sessions = new Map();

// Команда /start
bot.command('start', async (ctx) => {
  ctx.reply(
    'Добро пожаловать в BNAL Bank!\n\nВыберите действие:',
    Markup.keyboard([
      ['💳 Мои карты', '💱 Обмен криптовалюты'],
      ['💰 Баланс', '📊 Курсы валют']
    ]).resize()
  );
});

// Обработка "Мои карты"
bot.hears('💳 Мои карты', async (ctx) => {
  try {
    // Here we'll need to implement user authentication
    // For now, we'll show a message about authentication
    ctx.reply(
      'Для доступа к картам необходимо авторизоваться.\n\nИспользуйте команду /login для входа в систему.'
    );
  } catch (error) {
    console.error('Error handling cards request:', error);
    ctx.reply('Произошла ошибка при получении информации о картах');
  }
});

// Обработка "Курсы валют"
bot.hears('📊 Курсы валют', async (ctx) => {
  try {
    const rates = await storage.getLatestExchangeRates();
    ctx.reply(
      `📊 Текущие курсы валют:\n\n` +
      `BTC/USD: ${rates.btcToUsd}$\n` +
      `ETH/USD: ${rates.ethToUsd}$\n` +
      `USD/UAH: ${rates.usdToUah}₴`
    );
  } catch (error) {
    console.error('Error fetching rates:', error);
    ctx.reply('Не удалось получить текущие курсы валют');
  }
});

// Обработка команды для обмена криптовалюты
bot.hears('💱 Обмен криптовалюты', (ctx) => {
  ctx.reply(
    'Выберите криптовалюту для обмена:',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('Bitcoin (BTC)', 'exchange_btc'),
        Markup.button.callback('Ethereum (ETH)', 'exchange_eth')
      ]
    ])
  );
});

// Обработчики callback-запросов для обмена
bot.action(/exchange_(btc|eth)/, async (ctx) => {
  const currency = ctx.match[1].toUpperCase();
  sessions.set(ctx.from?.id, { step: 'amount', currency });
  
  await ctx.reply(
    `Введите сумму ${currency} для обмена на UAH:\n` +
    `Например: 0.1`
  );
});

// Обработка введенной суммы
bot.on('text', async (ctx) => {
  const session = sessions.get(ctx.from?.id);
  if (!session) return;

  const amount = parseFloat(ctx.message.text);
  if (isNaN(amount)) {
    return ctx.reply('Пожалуйста, введите корректную сумму');
  }

  if (session.step === 'amount') {
    sessions.set(ctx.from?.id, { 
      ...session, 
      step: 'card', 
      amount 
    });

    ctx.reply(
      'Введите номер украинской банковской карты для получения средств:\n' +
      'Например: 4111 1111 1111 1111'
    );
  } else if (session.step === 'card') {
    const cardNumber = ctx.message.text.replace(/\s+/g, '');
    if (!/^\d{16}$/.test(cardNumber)) {
      return ctx.reply('Пожалуйста, введите корректный номер карты (16 цифр)');
    }

    // Here we'll implement the actual exchange logic
    ctx.reply(
      '⚠️ Для выполнения обмена необходимо авторизоваться.\n\n' +
      'Используйте веб-версию приложения для выполнения операции.'
    );

    sessions.delete(ctx.from?.id);
  }
});

// Error handling
bot.catch((err: Error) => {
  console.error('Telegram bot error:', err);
});

export function startBot() {
  bot.launch()
    .then(() => {
      console.log('Telegram bot started successfully');
    })
    .catch(error => {
      console.error('Failed to start Telegram bot:', error);
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
