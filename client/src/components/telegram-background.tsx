import { useEffect, useState } from 'react';

// Declare global Telegram object for TypeScript
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        onEvent: (eventType: string, callback: () => void) => void;
        enableClosingConfirmation: () => void;
        backgroundColor?: string;
      };
    };
  }
}

export default function TelegramBackground() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Check if we're running inside Telegram WebApp
      const tg = window.Telegram?.WebApp;
      if (tg) {
        // Initialize Telegram WebApp
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation();

        // Listen for viewport changes
        tg.onEvent('viewportChanged', () => {
          console.log('Telegram WebApp viewport changed');
        });

        setIsTelegram(true);
        console.log('Telegram WebApp initialized successfully');
      } else {
        console.log('Not running in Telegram WebApp');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error initializing Telegram WebApp:', errorMessage);
      setError(errorMessage);
      setIsTelegram(false);
    }
  }, []);

  // Show error message if initialization failed
  if (error) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p className="text-sm">Ошибка инициализации Telegram WebApp: {error}</p>
      </div>
    );
  }

  // Return background only if we're in Telegram
  if (!isTelegram) return null;

  return (
    <div 
      className="fixed inset-0 z-0"
      style={{
        backgroundColor: window.Telegram?.WebApp?.backgroundColor || '#0088CC',
        opacity: 1
      }}
    />
  );
}