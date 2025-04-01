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
    
    // Создаем аудио элемент с запасным файлом
    // Сначала попробуем основной файл, если не загрузится - используем запасной
    const audio = new Audio('/audio/light-jazz.mp3');
    audio.loop = true;
    audio.volume = 0.1; // 10% громкости (очень тихо)
    
    // Обработка ошибки загрузки первого файла
    audio.addEventListener('error', () => {
      console.log('Не удалось загрузить основной аудиофайл, пробуем запасной');
      const fallbackAudio = new Audio('/audio/light-jazz-fallback.mp3');
      fallbackAudio.loop = true;
      fallbackAudio.volume = 0.1;
      setAudioElement(fallbackAudio);
    }, { once: true });
    
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
    if (!audioElement) {
      // Если аудио элемент еще не инициализирован, создаем его заново
      // Попробуем сразу запасной файл, который гарантированно загружен
      const audio = new Audio('/audio/light-jazz-fallback.mp3');
      audio.loop = true;
      audio.volume = 0.1;
      setAudioElement(audio);
      
      // Предварительная загрузка перед воспроизведением
      audio.load();
      
      // Пробуем воспроизвести после загрузки или сразу после взаимодействия пользователя
      try {
        // Попытка воспроизведения сразу после клика пользователя - часто работает
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Музыка успешно запущена');
              setIsPlaying(true);
            })
            .catch(error => {
              // Если сразу не получилось, пробуем через событие загрузки
              console.error('Первая попытка неудачна, ожидаем загрузки:', error);
              
              audio.addEventListener('canplaythrough', () => {
                audio.play()
                  .then(() => {
                    console.log('Музыка запущена после загрузки');
                    setIsPlaying(true);
                  })
                  .catch(() => setIsPlaying(false));
              }, { once: true });
            });
        }
      } catch (error) {
        console.error('Ошибка воспроизведения музыки:', error);
        setIsPlaying(false);
      }
      
      return;
    }
    
    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      // Удостоверимся, что аудио загружено
      if (audioElement.readyState < 2) { // HAVE_CURRENT_DATA
        audioElement.load();
      }
      
      // Пробуем воспроизвести
      const playPromise = audioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Музыка успешно запущена');
            setIsPlaying(true);
          })
          .catch(error => {
            console.error('Ошибка воспроизведения музыки:', error);
            // Еще одна попытка сразу после взаимодействия пользователя
            setTimeout(() => {
              audioElement.play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
            }, 100);
          });
      }
    }
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