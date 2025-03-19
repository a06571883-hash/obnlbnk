/**
 * Скрипт для настройки Telegram бота при деплое на Render.com
 * Автоматически устанавливает webhook на основе RENDER_EXTERNAL_URL
 */

const fetch = require('node-fetch');

async function setupTelegramWebhook() {
  try {
    // Получаем необходимые переменные окружения
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    const isRender = process.env.RENDER === 'true';
    const isProd = process.env.NODE_ENV === 'production';
    
    if (!botToken) {
      console.error('❌ Ошибка: Не указан TELEGRAM_BOT_TOKEN');
      return { success: false, error: 'Не указан TELEGRAM_BOT_TOKEN' };
    }

    if (!renderUrl) {
      console.error('❌ Ошибка: Не указан RENDER_EXTERNAL_URL');
      return { success: false, error: 'Не указан RENDER_EXTERNAL_URL' };
    }

    console.log('Настройка Telegram бота для Render.com');
    console.log(`URL приложения: ${renderUrl}`);
    console.log(`Окружение: ${isRender ? 'Render.com' : 'Другое'}`);
    console.log(`Режим: ${isProd ? 'Production' : 'Development'}`);

    // 1. Сначала удаляем любые существующие webhook
    console.log('Удаление существующих webhook...');
    const deleteResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`
    );
    const deleteData = await deleteResponse.json();
    
    if (!deleteData.ok) {
      console.error('❌ Ошибка при удалении webhook:', deleteData.description);
      return { success: false, error: deleteData.description };
    }
    
    console.log('✅ Существующие webhook успешно удалены');

    // 2. Устанавливаем новый webhook
    if (isRender && isProd) {
      const webhookUrl = `${renderUrl}/webhook/${botToken}`;
      console.log(`Установка webhook на URL: ${webhookUrl}`);
      
      const setResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            drop_pending_updates: true,
            allowed_updates: ["message", "callback_query"]
          })
        }
      );
      
      const setData = await setResponse.json();
      
      if (!setData.ok) {
        console.error('❌ Ошибка при установке webhook:', setData.description);
        return { success: false, error: setData.description };
      }
      
      console.log('✅ Webhook успешно установлен');
      
      // 3. Получаем информацию о webhook для проверки
      const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const infoData = await infoResponse.json();
      
      if (infoData.ok) {
        console.log('Информация о webhook:');
        console.log(`URL: ${infoData.result.url}`);
        console.log(`Ожидающие обновления: ${infoData.result.pending_update_count}`);
        console.log(`Последняя ошибка: ${infoData.result.last_error_message || 'Нет ошибок'}`);
      }
      
      return { 
        success: true, 
        mode: 'webhook',
        webhook_url: webhookUrl,
        info: infoData.result
      };
    } else {
      console.log('⚠️ Режим webhook не включен - используется long polling');
      console.log('Для включения webhook, установите RENDER=true и NODE_ENV=production');
      
      // 4. Настраиваем команды бота
      const commandsResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/setMyCommands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: [
              { command: "/start", description: "Запустить бота" },
              { command: "/url", description: "Получить текущий URL приложения" }
            ]
          })
        }
      );
      
      const commandsData = await commandsResponse.json();
      if (commandsData.ok) {
        console.log('✅ Команды бота успешно настроены');
      }
      
      return { 
        success: true, 
        mode: 'polling',
        message: 'Бот настроен для использования long polling'
      };
    }
  } catch (error) {
    console.error('❌ Ошибка при настройке Telegram бота:', error);
    return { success: false, error: error.message };
  }
}

// Выполняем настройку при запуске скрипта
setupTelegramWebhook().then(result => {
  if (result.success) {
    console.log(`✅ Telegram бот успешно настроен в режиме: ${result.mode}`);
    // Устанавливаем переменную WEBAPP_URL для Telegram WebApp
    if (!process.env.WEBAPP_URL && process.env.RENDER_EXTERNAL_URL) {
      process.env.WEBAPP_URL = process.env.RENDER_EXTERNAL_URL;
      console.log(`WEBAPP_URL установлен: ${process.env.WEBAPP_URL}`);
    }
  } else {
    console.error('❌ Не удалось настроить Telegram бота:', result.error);
  }
});

module.exports = { setupTelegramWebhook };