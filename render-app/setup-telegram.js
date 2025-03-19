/**
 * Скрипт для настройки Telegram webhook при деплое на Render.com
 * Автоматически устанавливает webhook на URL вашего приложения
 */

import fetch from 'node-fetch';

async function setupTelegramWebhook() {
  console.log('Настройка Telegram webhook для Render.com...');
  
  // Получаем необходимые переменные окружения
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  const isRender = process.env.RENDER === 'true';
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!botToken) {
    console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не найден в переменных окружения');
    console.error('   Пожалуйста, добавьте токен в настройках проекта на Render.com');
    return;
  }
  
  if (!renderUrl) {
    console.error('❌ Ошибка: RENDER_EXTERNAL_URL не найден в переменных окружения');
    console.error('   Этот скрипт должен запускаться только на Render.com');
    return;
  }
  
  // Проверяем, работаем ли мы на Render.com в production
  if (!isRender || !isProd) {
    console.log('⚠️ Не в производственном окружении на Render.com, webhook не будет настроен');
    console.log(`   isRender: ${isRender}, isProd: ${isProd}`);
    return;
  }
  
  try {
    // Формируем URL для webhook
    const webhookUrl = `${renderUrl}/webhook/${botToken}`;
    console.log(`Настраиваем webhook на URL: ${webhookUrl}`);
    
    // Удаляем текущий webhook (если есть)
    const deleteResponse = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
    const deleteData = await deleteResponse.json();
    
    if (!deleteData.ok) {
      console.error(`❌ Ошибка при удалении существующего webhook: ${deleteData.description}`);
      return;
    }
    
    console.log('✅ Существующий webhook успешно удален');
    
    // Устанавливаем новый webhook
    const setResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    });
    
    const setData = await setResponse.json();
    
    if (!setData.ok) {
      console.error(`❌ Ошибка при установке webhook: ${setData.description}`);
      return;
    }
    
    console.log('✅ Webhook успешно установлен!');
    
    // Получаем информацию о текущем webhook
    const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const infoData = await infoResponse.json();
    
    if (!infoData.ok) {
      console.error(`❌ Ошибка при получении информации о webhook: ${infoData.description}`);
      return;
    }
    
    console.log('📊 Информация о webhook:');
    console.log(JSON.stringify(infoData.result, null, 2));
    
    // Обновляем информацию о WebApp
    const setUrlResponse = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: 'Открыть BNAL Bank',
          web_app: { url: renderUrl }
        }
      })
    });
    
    const setUrlData = await setUrlResponse.json();
    
    if (!setUrlData.ok) {
      console.error(`❌ Ошибка при обновлении меню бота: ${setUrlData.description}`);
    } else {
      console.log('✅ Меню бота успешно обновлено');
    }
    
    // Обновляем команды бота
    const commandsResponse = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: '/start', description: 'Запустить бота' },
          { command: '/url', description: 'Получить URL приложения' }
        ]
      })
    });
    
    const commandsData = await commandsResponse.json();
    
    if (!commandsData.ok) {
      console.error(`❌ Ошибка при обновлении команд бота: ${commandsData.description}`);
    } else {
      console.log('✅ Команды бота успешно обновлены');
    }
    
    console.log('📱 Telegram бот полностью настроен для работы на Render.com!');
    console.log(`   URL: ${renderUrl}`);
    console.log(`   Webhook: ${webhookUrl}`);
    
  } catch (error) {
    console.error('❌ Произошла ошибка при настройке Telegram webhook:');
    console.error(error);
  }
}

// Запускаем настройку
setupTelegramWebhook().catch(console.error);