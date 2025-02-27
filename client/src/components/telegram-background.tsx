import { useEffect, useState } from 'react';

export default function TelegramBackground() {
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    // Проверяем, открыто ли приложение в Telegram WebApp
    const isTelegramWebApp = window.Telegram?.WebApp != null;
    setIsTelegram(isTelegramWebApp);
  }, []);

  if (!isTelegram) return null;

  return (
    <div 
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        background: `
          linear-gradient(
            45deg,
            #3498db,
            #2980b9,
            #2ecc71,
            #3498db
          )
        `,
        backgroundSize: '400% 400%',
        animation: 'gradient 15s ease infinite',
        opacity: '0.8',
      }}
    >
      <style jsx>{`
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
      <div 
        className="absolute inset-0"
        style={{
          background: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 50px,
              rgba(255,255,255,0.1) 50px,
              rgba(255,255,255,0.1) 100px
            )
          `,
        }}
      />
    </div>
  );
}
