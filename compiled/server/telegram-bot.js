import { Telegraf } from 'telegraf';
// Используем токен из переменных окружения или задаем новый
// ИЗМЕНИТЬ ЗДЕСЬ, если нужно поменять токен бота
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8026692414:AAHPv3spA0mVAPX91Tuw6g37FaXyLMHVB08';
// Определяем, откуда запущено приложение (Replit или Render)
const IS_RENDER = process.env.RENDER === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Определяем URL приложения в зависимости от среды
let WEBAPP_URL = process.env.WEBAPP_URL;
// Для Replit используем постоянный URL
if (!WEBAPP_URL) {
    // Постоянный URL для Replit
    if (!IS_RENDER && !IS_PRODUCTION) {
        WEBAPP_URL = 'https://ooobnalbank.replit.app/';
    }
    else if (IS_RENDER && IS_PRODUCTION) {
        // Для Render используем постоянный URL
        WEBAPP_URL = process.env.RENDER_EXTERNAL_URL || 'https://app.example.com/';
    }
}
// Убедимся, что URL всегда определен
if (!WEBAPP_URL) {
    WEBAPP_URL = 'https://ooobnalbank.replit.app/';
}
// Сохраняем URL в переменных окружения
process.env.WEBAPP_URL = WEBAPP_URL;
console.log('Используется WEBAPP_URL:', WEBAPP_URL);
console.log('Окружение:', IS_RENDER ? 'Render.com' : 'Replit');
console.log('Режим:', IS_PRODUCTION ? 'Production' : 'Development');
if (!BOT_TOKEN) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не найден в переменных окружения');
    console.error('Добавьте токен бота в секреты приложения');
}
else {
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
        return ctx.reply('Добро пожаловать в BNAL Bank! Нажмите на голубую кнопку внизу экрана, чтобы открыть приложение.\n\n<b>Внимание:</b> Приложение доступно только во время работы сервера. Если вы видите ошибку, это означает, что сервер в данный момент не активен.', {
            parse_mode: 'HTML'
        });
    }
    catch (error) {
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
    if (!WEBAPP_URL) {
        console.error('Невозможно запустить Telegram бот: отсутствует WEBAPP_URL');
        console.log('Пожалуйста, установите URL приложения в переменных окружения');
        return;
    }
    console.log('Запуск Telegram бота...');
    console.log('WebApp URL:', WEBAPP_URL);
    console.log('Переменные окружения:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- RENDER:', process.env.RENDER);
    console.log('- RENDER_EXTERNAL_URL:', process.env.RENDER_EXTERNAL_URL);
    // Проверяем работу бота через API
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
        .then(res => res.json())
        .then(data => {
        if (data.ok) {
            console.log('✅ Telegram бот успешно проверен через API');
            console.log('Имя бота:', data.result.username);
            console.log('WebApp URL:', WEBAPP_URL);
            // Обновляем WebApp URL для бота
            fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    menu_button: {
                        type: 'web_app',
                        text: 'Открыть BNAL Bank',
                        web_app: { url: WEBAPP_URL }
                    }
                })
            })
                .then(res => res.json())
                .then(menuData => {
                console.log('Результат обновления WebApp URL:', menuData.ok ? 'Успешно' : 'Ошибка');
                if (!menuData.ok) {
                    console.error('Ошибка обновления меню:', menuData.description);
                    return;
                }
                console.log('WebApp URL успешно обновлен');
                // Определяем режим работы: WebHook для Render, Long Polling для Replit
                if (IS_RENDER && IS_PRODUCTION && WEBAPP_URL) {
                    // Режим WebHook для Render.com
                    console.log('Запуск в режиме WebHook (Render.com)...');
                    setupWebhook();
                }
                else {
                    // Режим Long Polling для Replit (временный URL)
                    console.log('Запуск в режиме Long Polling (Replit)...');
                    setupLongPolling();
                }
            })
                .catch(err => console.error('Ошибка при обновлении WebApp URL:', err));
        }
        else {
            console.error('❌ Ошибка проверки бота:', data);
        }
    })
        .catch(error => {
        console.error('❌ Не удалось проверить Telegram бот:', error);
        console.error('Проверьте правильность токена бота и доступ к API Telegram');
    });
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
// Настройка режима WebHook для Render.com
function setupWebhook() {
    const webhookUrl = `${WEBAPP_URL}/webhook/${BOT_TOKEN}`;
    console.log('Настройка webhook на URL:', webhookUrl);
    // Устанавливаем webhook
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: webhookUrl,
            drop_pending_updates: true
        })
    })
        .then(res => res.json())
        .then(data => {
        if (data.ok) {
            console.log('✅ Webhook успешно настроен');
            console.log('Описание:', data.description);
            // Проверяем информацию о webhook
            fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
                .then(res => res.json())
                .then(webhookInfo => {
                console.log('Информация о webhook:');
                console.log('- URL:', webhookInfo.result.url);
                console.log('- Pending updates:', webhookInfo.result.pending_update_count);
                console.log('- Last error date:', webhookInfo.result.last_error_date);
                console.log('- Last error message:', webhookInfo.result.last_error_message);
            })
                .catch(err => console.error('Ошибка получения информации о webhook:', err));
        }
        else {
            console.error('❌ Ошибка настройки webhook:', data.description);
        }
    })
        .catch(err => console.error('Ошибка при настройке webhook:', err));
}
// Настройка режима Long Polling для Replit
function setupLongPolling() {
    // Очищаем настройки webhook если они были раньше
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`)
        .then(res => res.json())
        .then(deleteWebhookData => {
        console.log('Webhook удален:', deleteWebhookData.ok ? 'Успешно' : 'Ошибка');
        if (!deleteWebhookData.ok) {
            console.error('Ошибка удаления webhook:', deleteWebhookData.description);
            return;
        }
        console.log('Старые настройки webhook успешно очищены');
        // Начинаем периодическую проверку новых сообщений
        const UPDATE_INTERVAL = 5000; // 5 секунд
        console.log(`Начинаем проверку новых сообщений с интервалом ${UPDATE_INTERVAL}ms...`);
        let lastUpdateId = 0;
        // Функция для получения обновлений
        function getUpdates() {
            fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`)
                .then(res => res.json())
                .then(updatesData => {
                if (updatesData.ok && updatesData.result.length > 0) {
                    console.log(`Получено ${updatesData.result.length} новых сообщений`);
                    // Обрабатываем каждое обновление
                    updatesData.result.forEach((update) => {
                        // Запоминаем последний ID, чтобы не получать одно и то же обновление дважды
                        if (update.update_id > lastUpdateId) {
                            lastUpdateId = update.update_id;
                        }
                        // Если это сообщение, обрабатываем его
                        if (update.message) {
                            const message = update.message;
                            const chatId = message.chat.id;
                            const text = message.text;
                            // Обрабатываем команды и сообщения
                            if (text === '/start') {
                                // Отправляем приветственное сообщение и кнопку WebApp
                                fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        chat_id: chatId,
                                        text: 'Добро пожаловать в BNAL Bank!\n\nНажмите кнопку ниже, чтобы открыть приложение.',
                                        reply_markup: {
                                            inline_keyboard: [[
                                                    {
                                                        text: '🏦 Открыть BNAL Bank',
                                                        web_app: { url: WEBAPP_URL }
                                                    }
                                                ]]
                                        }
                                    })
                                })
                                    .then(response => response.json())
                                    .then(data => {
                                    console.log('Ответ на команду /start отправлен:', data.ok);
                                })
                                    .catch(error => {
                                    console.error('Ошибка отправки ответа:', error);
                                });
                            }
                            else if (text === '/url') {
                                // Отправляем текущий URL приложения
                                fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        chat_id: chatId,
                                        text: `Текущий URL приложения:\n${WEBAPP_URL}\n\n${IS_RENDER ? 'Это постоянный URL на Render.com' : 'Обратите внимание, что URL временный и действует только пока проект запущен в Replit.'}`,
                                        reply_markup: {
                                            inline_keyboard: [[
                                                    {
                                                        text: '🏦 Открыть BNAL Bank',
                                                        web_app: { url: WEBAPP_URL }
                                                    }
                                                ]]
                                        }
                                    })
                                })
                                    .then(response => response.json())
                                    .then(data => {
                                    console.log('Ответ на команду /url отправлен:', data.ok);
                                })
                                    .catch(error => {
                                    console.error('Ошибка отправки ответа:', error);
                                });
                            }
                            else {
                                // Отвечаем на другие сообщения
                                fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        chat_id: chatId,
                                        text: 'Доступные команды:\n/start - начать\n/url - получить текущий URL приложения\n\nИспользуйте кнопку "Открыть BNAL Bank", чтобы запустить приложение.'
                                    })
                                })
                                    .then(response => response.json())
                                    .then(data => {
                                    console.log('Ответ на сообщение отправлен:', data.ok);
                                })
                                    .catch(error => {
                                    console.error('Ошибка отправки ответа:', error);
                                });
                            }
                        }
                    });
                }
                // В любом случае, успешно или нет, продолжаем проверять обновления
                setTimeout(getUpdates, UPDATE_INTERVAL);
            })
                .catch(error => {
                console.error('Ошибка получения обновлений:', error);
                // В случае ошибки тоже продолжаем проверять, но с задержкой
                setTimeout(getUpdates, UPDATE_INTERVAL * 2);
            });
        }
        // Запускаем первую проверку обновлений
        getUpdates();
    })
        .catch(err => console.error('Ошибка при удалении webhook:', err));
}
