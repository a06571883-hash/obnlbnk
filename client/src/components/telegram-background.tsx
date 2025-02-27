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
            217deg,
            #419FD9 0%,
            #0088CC 40%,
            #32A9E1 80%,
            #419FD9 100%
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
              rgba(255,255,255,0.1),
              rgba(255,255,255,0.1) 10px,
              rgba(255,255,255,0.2) 10px,
              rgba(255,255,255,0.2) 20px
            )
          `,
          animation: 'wave 10s linear infinite',
          opacity: '0.5',
        }}
      />
      <style>{`
        @keyframes wave {
          0% {
            transform: translateX(0) translateY(0);
          }
          100% {
            transform: translateX(20px) translateY(-20px);
          }
        }
      `}</style>
    </div>
  );
}