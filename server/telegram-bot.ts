import { Telegraf } from 'telegraf';

// Используем токен из переменных окружения или задаем новый
// ИЗМЕНИТЬ ЗДЕСЬ, если нужно поменять токен бота
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7464154474:AAGxQmjQAqrT1WuH4ksuhExRiAc6UWX1ak4';

// ИЗМЕНИТЬ ЗДЕСЬ, если нужно поменять URL приложения
// Использовать фиксированный URL для стабильной работы
const BASE_URL = 'https://a94eb6c1-c5d1-4dd4-933a-930b9ad1e43c-00-3tpaapxqq7ajh.worf.replit.dev';
const WEBAPP_URL = BASE_URL;

// Сохраняем URL в переменных окружения
process.env.WEBAPP_URL = WEBAPP_URL;

console.log('Используется WEBAPP_URL:', WEBAPP_URL);

if (!BOT_TOKEN) {
  console.error('КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не найден в переменных окружения');
  console.error('Добавьте токен бота в секреты Replit (Tools > Secrets)');
} else {
  console.log('Токен бота найден успешно');
}

// Создаем экземпляр бота
const bot = new Telegraf(BOT_TOKEN);

// Команда /start
bot.command('start', (ctx) => {
  try {
    console.log(`Пользователь ${ctx.from.id} (${ctx.from.username || 'без имени'}) запустил бота`);
    console.log('Отправка WebApp URL напрямую:', WEBAPP_URL);

    // Настраиваем главную кнопку WebApp
    ctx.setChatMenuButton({
      text: 'Открыть BNAL Bank',
      type: 'web_app',
      web_app: { url: WEBAPP_URL }
    }).catch(err => console.error('Ошибка при установке главной кнопки WebApp:', err));

    return ctx.reply('Добро пожаловать в BNAL Bank! Нажмите на голубую кнопку внизу экрана, чтобы открыть приложение.', {
      parse_mode: 'HTML'
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