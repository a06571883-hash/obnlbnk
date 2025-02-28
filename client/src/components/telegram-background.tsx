import { useEffect, useState } from 'react';

// Declare global Telegram object for TypeScript
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        backgroundColor?: string;
        initData?: string;
        initDataUnsafe?: any;
      };
    };
  }
}

export default function TelegramBackground() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log('Проверка Telegram WebApp...');

      // Пытаемся получить объект Telegram.WebApp
      const tg = window.Telegram?.WebApp;

      // Проверяем, открыто ли приложение через Telegram
      const urlParams = new URLSearchParams(window.location.search);
      const telegramQueryParam = urlParams.get('tgWebAppStartParam') || 
                               urlParams.get('tgWebAppData') || 
                               urlParams.get('web_app_data');
      
      // Или проверяем через referrer
      const isTelegramReferrer = document.referrer.includes('t.me') || 
                                document.referrer.includes('telegram.org') ||
                                window.location.hostname.includes('t.me');

      if (!tg && !telegramQueryParam && !isTelegramReferrer) {
        console.log('Приложение открыто не через Telegram');
        // Эмулируем объект WebApp для локального тестирования
        window.Telegram = window.Telegram || {};
        window.Telegram.WebApp = window.Telegram.WebApp || {
          ready: () => console.log('WebApp ready emulated'),
          expand: () => console.log('WebApp expand emulated'),
          initData: 'emulated',
          initDataUnsafe: {}
        };
      }

      // Повторно получаем объект Telegram.WebApp после эмуляции
      const webApp = window.Telegram?.WebApp;

      if (webApp) {
        console.log('Telegram WebApp найден, инициализация...');
        console.log('initData присутствует:', !!webApp.initData);

        // Инициализируем WebApp
        webApp.ready();
        webApp.expand();

        setIsTelegram(true);
        console.log('Telegram WebApp успешно инициализирован');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error('Ошибка инициализации Telegram WebApp:', errorMessage);
      setError(errorMessage);
    }
  }, []);

  // Показываем ошибку, если что-то пошло не так
  if (error) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md">
        <strong className="font-bold">Ошибка!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return null;
}