import { useEffect, useState } from 'react';

// Типы Telegram импортируются из telegram-utils

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

      console.log('Telegram WebApp найден!');
      console.log('WebApp API версия:', tg.version);
      console.log('InitData присутствует:', !!tg.initData);

      // Инициализируем WebApp
      tg.ready();
      tg.expand();

      setIsTelegram(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error('Ошибка инициализации Telegram WebApp:', errorMessage);
      setError(errorMessage);
    }
  }, []);

  // Возвращаем пустой фрагмент, так как компонент не отображает UI
  return null;
}