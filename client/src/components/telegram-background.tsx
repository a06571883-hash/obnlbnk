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
  }, []);

  if (!isTelegram) return null;

  return (
    <div 
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        background: `
          linear-gradient(
            135deg,
            #0088cc 0%,
            #00a1e4 40%,
            #00c2ff 80%,
            #0088cc 100%
          )
        `,
        backgroundSize: '400% 400%',
        animation: 'gradient 15s ease infinite',
        opacity: '0.9',
      }}
    >
      <style>{`
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
              rgba(255,255,255,0.05),
              rgba(255,255,255,0.05) 15px,
              rgba(255,255,255,0.1) 15px,
              rgba(255,255,255,0.1) 30px
            )
          `,
          animation: 'wave 12s linear infinite',
          opacity: '0.4',
        }}
      />
      <style>{`
        @keyframes wave {
          0% {
            transform: translate(0px, 0px);
          }
          100% {
            transform: translate(30px, -30px);
          }
        }
      `}</style>
    </div>
  );
}