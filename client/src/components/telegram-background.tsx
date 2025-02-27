import { useEffect, useState } from 'react';

// Declare global Telegram object for TypeScript
declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export default function TelegramBackground() {
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    // Проверяем, открыто ли приложение в Telegram WebApp
    const isTelegramWebApp = window.Telegram?.WebApp != null;
    setIsTelegram(isTelegramWebApp);

    if (isTelegramWebApp) {
      console.log("Running in Telegram WebApp");
    }
  }, []);

  if (!isTelegram) return null;

  return (
    <div 
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        backgroundColor: '#0088cc',
        opacity: 0.9
      }}
    />
  );
}