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
      
      // Создаем функцию инициализации
      const initTelegramWebApp = () => {
        // Попытка получить Telegram WebApp API
        if (window.Telegram && window.Telegram.WebApp) {
          console.log('Telegram WebApp найден!');
          
          const tgWebApp = window.Telegram.WebApp;
          console.log('WebApp API версия:', tgWebApp.version);
          console.log('InitData присутствует:', !!tgWebApp.initData);
          
          // Инициализируем WebApp
          tgWebApp.ready();
          tgWebApp.expand();
          
          setIsTelegram(true);
          return true;
        }
        return false;
      };

      // Проверяем наличие Telegram WebApp сразу
      if (!initTelegramWebApp()) {
        console.log('WebApp не найден, проверка параметров URL...');
        
        // Проверим, запущено ли из Telegram по параметрам URL
        const urlParams = new URLSearchParams(window.location.search);
        const isTelegramByParams = urlParams.has('tgWebAppStartParam') || 
                                  urlParams.has('tgWebAppData') || 
                                  urlParams.has('source') && urlParams.get('source') === 'telegram';
        
        if (isTelegramByParams) {
          console.log('Обнаружены параметры Telegram в URL, ожидание загрузки API...');
          
          // Ждем немного и пробуем снова (возможно API еще загружается)
          const maxRetries = 5;
          let retryCount = 0;
          
          const retryInit = setInterval(() => {
            if (initTelegramWebApp() || retryCount >= maxRetries) {
              clearInterval(retryInit);
              
              if (retryCount >= maxRetries) {
                console.log('Не удалось загрузить Telegram WebApp после нескольких попыток');
                // Создаем эмуляцию для тестирования
                window.Telegram = window.Telegram || {};
                window.Telegram.WebApp = window.Telegram.WebApp || {
                  ready: () => console.log('WebApp ready emulated'),
                  expand: () => console.log('WebApp expand emulated'),
                  initData: 'emulated',
                  initDataUnsafe: {},
                  version: '6.0'
                };
                setIsTelegram(true);
              }
            }
            retryCount++;
          }, 500);
          
          return () => clearInterval(retryInit);
        } else {
          console.log('Приложение открыто не через Telegram');
          // Создаем эмуляцию для тестирования
          window.Telegram = window.Telegram || {};
          window.Telegram.WebApp = window.Telegram.WebApp || {
            ready: () => console.log('WebApp ready emulated'),
            expand: () => console.log('WebApp expand emulated'),
            initData: 'emulated',
            initDataUnsafe: {},
            version: '6.0'
          };
          setIsTelegram(true);
        }
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