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
    const isTelegramWebApp = window.Telegram?.WebApp != null;
    setIsTelegram(isTelegramWebApp);
  }, []);

  if (!isTelegram) return null;

  return (
    <div 
      className="fixed inset-0 z-[-1]"
      style={{
        backgroundColor: '#4FA9E7',
        opacity: 1
      }}
    />
  );
}