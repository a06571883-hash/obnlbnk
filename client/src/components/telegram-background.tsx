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

      if (!tg) {
        console.log('Приложение открыто не через Telegram или WebApp объект не найден');
        return;
      }

      console.log('Telegram WebApp найден, инициализация...');
      console.log('initData присутствует:', !!tg.initData);

      // Инициализируем WebApp
      tg.ready();
      tg.expand();

      setIsTelegram(true);
      console.log('Telegram WebApp успешно инициализирован');
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