import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Volume2, VolumeX } from "lucide-react";
import { isTelegramWebApp } from "../lib/telegram-utils";

const TelegramTestPage: React.FC = () => {
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogMessages(prev => [...prev, `[${new Date().toISOString().substring(11, 19)}] ${message}`]);
  };

  useEffect(() => {
    try {
      addLog('Инициализация аудио элемента...');
      
      // Создаем аудио элемент
      const audio = new Audio('/audio/light-jazz-fallback.mp3');
      audio.loop = true;
      audio.volume = 0.1; // 10% громкости (очень тихо)
      
      // Добавляем обработчики событий
      audio.addEventListener('canplaythrough', () => {
        addLog('Аудио файл загружен и готов к воспроизведению');
        setAudioLoaded(true);
      });
      
      audio.addEventListener('error', (e) => {
        const error = e.currentTarget as HTMLAudioElement;
        addLog(`Ошибка загрузки аудио: ${error.error?.message || 'Неизвестная ошибка'}`);
        setLoadingError(error.error?.message || 'Ошибка загрузки аудио');
      });
      
      audio.load(); // Начинаем загрузку аудио
      
      setAudioElement(audio);
      addLog('Аудио элемент инициализирован');
      
      return () => {
        // Очистка при размонтировании
        if (audio) {
          audio.pause();
          audio.src = '';
          addLog('Аудио элемент удален');
        }
      };
    } catch (error) {
      addLog(`Ошибка при инициализации аудио: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setLoadingError(`Ошибка при инициализации аудио: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }, []);

  // Функция для переключения воспроизведения музыки
  const toggleMusic = () => {
    if (!audioElement) {
      addLog('Аудио элемент не инициализирован');
      return;
    }
    
    try {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
        addLog('Музыка остановлена');
      } else {
        // Попытка воспроизведения
        addLog('Попытка воспроизведения музыки');
        const playPromise = audioElement.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              addLog('Музыка успешно запущена');
              setIsPlaying(true);
            })
            .catch(error => {
              addLog(`Ошибка воспроизведения: ${error.message}`);
              setLoadingError(`Ошибка воспроизведения: ${error.message}`);
              
              // Еще одна попытка после взаимодействия
              setTimeout(() => {
                addLog('Повторная попытка воспроизведения');
                audioElement.play()
                  .then(() => {
                    addLog('Музыка успешно запущена при повторной попытке');
                    setIsPlaying(true);
                  })
                  .catch(e => {
                    addLog(`Повторная попытка не удалась: ${e.message}`);
                    setLoadingError(`Повторная попытка не удалась: ${e.message}`);
                  });
              }, 100);
            });
        }
      }
    } catch (error) {
      addLog(`Ошибка при управлении воспроизведением: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setLoadingError(`Ошибка при управлении воспроизведением: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Тестирование Аудио в {isTelegramWebApp() ? 'Telegram WebApp' : 'Браузере'}</CardTitle>
          <CardDescription>
            Используйте эту страницу для тестирования воспроизведения аудио
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-center">
              <Button
                onClick={toggleMusic}
                variant="outline"
                size="lg"
                className={`w-full ${isPlaying ? 'bg-primary/10' : ''}`}
                disabled={!audioLoaded && !loadingError}
              >
                {isPlaying ? (
                  <><VolumeX className="mr-2 h-5 w-5" /> Выключить музыку</>
                ) : (
                  <><Volume2 className="mr-2 h-5 w-5" /> Включить музыку</>
                )}
              </Button>
            </div>
            
            <div className="text-sm">
              <p>Статус: {audioLoaded ? 'Аудио загружено' : 'Загрузка аудио...'}</p>
              {loadingError && (
                <p className="text-red-500 mt-2">Ошибка: {loadingError}</p>
              )}
              {isPlaying && (
                <p className="text-green-500 mt-2">Музыка воспроизводится</p>
              )}
            </div>
            
            <div className="mt-6">
              <h3 className="font-medium mb-2">Логи:</h3>
              <div className="bg-muted p-2 rounded-md text-xs h-40 overflow-y-auto">
                {logMessages.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))}
                {logMessages.length === 0 && <p className="text-muted-foreground">Логи отсутствуют</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramTestPage;