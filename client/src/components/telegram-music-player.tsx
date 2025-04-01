import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import { isTelegramWebApp } from '../lib/telegram-utils';
import { isJazzEnabled, toggleJazz } from '../lib/sound-service';

// Компонент для воспроизведения настоящей джазовой музыки в Telegram WebApp
const TelegramMusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTelegramApp, setIsTelegramApp] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  
  // Музыкальные файлы в порядке приоритета
  const audioSources = [
    '/music/jazz_composition.wav',  // Наша сгенерированная композиция
    '/jazz/smooth-jazz.mp3',        // Альтернативный путь
    '/audio/jazz_music.mp3'         // Еще один возможный путь
  ];
  
  useEffect(() => {
    // Проверяем, запущено ли приложение в Telegram WebApp
    const isTgApp = isTelegramWebApp();
    setIsTelegramApp(isTgApp);
    
    // Если это не Telegram WebApp, ничего не делаем
    if (!isTgApp) return;
    
    // Создаем аудио элемент
    if (!audioRef.current) {
      const audio = new Audio();
      audio.src = audioSources[0]; // Используем первый источник по умолчанию
      audio.volume = 0.2;          // Устанавливаем тихую громкость
      audio.loop = true;           // Зацикливаем воспроизведение
      audio.preload = 'auto';      // Предзагружаем аудио
      
      // Обработчик ошибок для переключения на альтернативные источники
      audio.onerror = (e) => {
        console.error(`Ошибка воспроизведения аудио: ${audio.src}`, e);
        
        // Находим текущий индекс источника
        const currentIndex = audioSources.findIndex(src => audio.src.endsWith(src));
        
        // Если есть следующий источник, пробуем его
        if (currentIndex >= 0 && currentIndex < audioSources.length - 1) {
          const nextSource = audioSources[currentIndex + 1];
          console.log(`Переключаемся на альтернативный источник: ${nextSource}`);
          audio.src = nextSource;
          
          // Если музыка должна играть, пробуем воспроизвести новый источник
          if (isPlaying) {
            audio.play().catch(err => {
              console.warn('Ошибка при переключении источника:', err);
            });
          }
        }
      };
      
      audioRef.current = audio;
    }
    
    // Отмечаем, что компонент инициализирован
    isInitializedRef.current = true;
    
    // Проверяем состояние музыки из localStorage
    const enabled = isJazzEnabled();
    setIsPlaying(enabled);
    
    // Если музыка должна играть при загрузке
    if (enabled) {
      // Добавляем обработчик взаимодействия пользователя для запуска музыки
      // (обход ограничений браузеров на автовоспроизведение)
      const userInteractionHandler = () => {
        if (!audioRef.current || !isInitializedRef.current) return;
        
        setTimeout(() => {
          try {
            if (audioRef.current && audioRef.current.paused && enabled) {
              audioRef.current.play()
                .then(() => console.log('Музыка успешно запущена после взаимодействия'))
                .catch(err => console.warn('Не удалось запустить музыку:', err));
            }
          } catch (err) {
            console.error('Ошибка при автозапуске музыки:', err);
          }
        }, 300);
      };
      
      // Добавляем слушатели событий
      window.addEventListener('click', userInteractionHandler);
      window.addEventListener('touchend', userInteractionHandler);
      
      // Удаляем слушатели через 5 секунд
      setTimeout(() => {
        window.removeEventListener('click', userInteractionHandler);
        window.removeEventListener('touchend', userInteractionHandler);
      }, 5000);
    }
    
    // Для очистки ресурсов при размонтировании компонента
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      
      isInitializedRef.current = false;
    };
  }, []);
  
  // Функция для переключения воспроизведения музыки
  const toggleMusic = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      // Остановка воспроизведения
      audioRef.current.pause();
      setIsPlaying(false);
      console.log('Музыка остановлена');
      toggleJazz(false);
    } else {
      // Запуск воспроизведения
      try {
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              console.log('Музыка запущена');
              toggleJazz(true);
            })
            .catch(error => {
              console.error('Ошибка при запуске музыки:', error);
              
              // Пробуем переключиться на следующий источник
              const currentSrc = audioRef.current?.src || '';
              const currentIndex = audioSources.findIndex(src => currentSrc.endsWith(src));
              
              if (currentIndex >= 0 && currentIndex < audioSources.length - 1) {
                const nextSource = audioSources[currentIndex + 1];
                console.log(`Пробуем альтернативный источник: ${nextSource}`);
                
                if (audioRef.current) {
                  audioRef.current.src = nextSource;
                  audioRef.current.play()
                    .then(() => {
                      setIsPlaying(true);
                      toggleJazz(true);
                    })
                    .catch(err => {
                      console.error('Ошибка со вторым источником:', err);
                      setIsPlaying(false);
                      toggleJazz(false);
                    });
                }
              } else {
                setIsPlaying(false);
                toggleJazz(false);
              }
            });
        }
      } catch (error) {
        console.error('Критическая ошибка при включении музыки:', error);
        setIsPlaying(false);
        toggleJazz(false);
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
        title={isPlaying ? "Выключить настоящий джаз" : "Включить настоящий джаз"}
      >
        {isPlaying ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </Button>
    </div>
  );
};

export default TelegramMusicPlayer;