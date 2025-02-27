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
      className="fixed inset-0 z-0"
      style={{
        backgroundColor: '#0088CC',
        opacity: 1
      }}
    />
  );
}