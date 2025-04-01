import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import { isTelegramWebApp } from '../lib/telegram-utils';

// Компонент управления фоновой музыкой для Telegram WebApp
const TelegramMusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isTelegramApp, setIsTelegramApp] = useState(false);
  
  useEffect(() => {
    // Проверяем, запущено ли приложение в Telegram WebApp
    setIsTelegramApp(isTelegramWebApp());
    
    // Если это не Telegram WebApp, ничего не делаем
    if (!isTelegramWebApp()) return;
    
    // Создаем аудио элемент
    const audio = new Audio('/audio/light-jazz.mp3');
    audio.loop = true;
    audio.volume = 0.1; // 10% громкости (очень тихо)
    setAudioElement(audio);
    
    // Очистка при размонтировании
    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);
  
  // Функция для переключения воспроизведения музыки
  const toggleMusic = () => {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      // При запуске воспроизведения сначала сбрасываем время
      audioElement.currentTime = 0;
      // Запускаем воспроизведение с обработкой ошибок
      audioElement.play().catch(error => {
        console.error('Ошибка воспроизведения музыки:', error);
        setIsPlaying(false);
      });
    }
    
    setIsPlaying(!isPlaying);
  };
  
  // Если это не Telegram WebApp, не отображаем компонент
  if (!isTelegramApp) return null;
  
  return (
    <div className="fixed bottom-24 right-4 z-50">
      <Button
        variant="secondary"
        size="icon"
        className="rounded-full shadow-md h-10 w-10"
        onClick={toggleMusic}
        title={isPlaying ? "Выключить фоновую музыку" : "Включить фоновую музыку"}
      >
        {isPlaying ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </Button>
    </div>
  );
};

export default TelegramMusicPlayer;