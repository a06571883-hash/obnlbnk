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
      addLog('Инициализация Web Audio API...');
      
      // Вместо использования аудиофайла, создадим звук программно с помощью Web Audio API
      const initializeWebAudio = () => {
        try {
          // Проверка поддержки Web Audio API
          if (typeof window === 'undefined' || !window.AudioContext) {
            addLog('Web Audio API не поддерживается в этом браузере');
            setLoadingError('Web Audio API не поддерживается');
            return null;
          }
          
          // Создаем аудиоконтекст
          const AudioContext = window.AudioContext;
          const audioContext = new AudioContext();
          
          // Создаем общий узел усиления
          const masterGain = audioContext.createGain();
          masterGain.gain.value = 0.1; // 10% громкости
          masterGain.connect(audioContext.destination);
          
          addLog('Web Audio API инициализирован успешно');
          setAudioLoaded(true);
          
          return { audioContext, masterGain };
        } catch (error) {
          addLog(`Ошибка инициализации Web Audio API: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
          setLoadingError(`Ошибка инициализации Web Audio API: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
          return null;
        }
      };
      
      // Объект для хранения генерируемых осцилляторов
      const oscillators: { osc: OscillatorNode, gain: GainNode }[] = [];
      
      // Функция для воспроизведения ноты
      const playNote = (audioContext: AudioContext, masterGain: GainNode, frequency: number, startTime: number, duration: number) => {
        // Создаем осциллятор (генератор звуковой волны)
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine'; // Синусоидальная волна для мягкого звука
        oscillator.frequency.value = frequency; // Частота ноты
        
        // Создаем узел усиления для контроля громкости
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.1;
        
        // Настраиваем затухание звука
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.02); // Быстрая атака
        gainNode.gain.linearRampToValueAtTime(0.05, startTime + duration * 0.5); // Плавное снижение
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration); // Затухание в конце
        
        // Подключаем осциллятор к усилителю, затем к основному выходу
        oscillator.connect(gainNode);
        gainNode.connect(masterGain);
        
        // Запускаем и останавливаем осциллятор в нужное время
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
        
        // Сохраняем ссылки для возможности остановки
        oscillators.push({ osc: oscillator, gain: gainNode });
      };
      
      // Функция для воспроизведения джазовой последовательности
      const playJazzSequence = (audioCtx: AudioContext, masterGain: GainNode) => {
        // Определяем ноты (в джазовой гамме)
        const jazzScale = [
          261.63, // C4
          293.66, // D4
          329.63, // E4
          349.23, // F4
          392.00, // G4
          440.00, // A4
          493.88, // B4
          523.25, // C5
        ];
        
        // Джазовая последовательность аккордов (C, Dm, G7, C)
        const now = audioCtx.currentTime;
        let time = now;
        
        // Первый аккорд - C мажор (C, E, G)
        playNote(audioCtx, masterGain, jazzScale[0], time, 0.8); // C
        playNote(audioCtx, masterGain, jazzScale[2], time + 0.05, 0.8); // E
        playNote(audioCtx, masterGain, jazzScale[4], time + 0.1, 0.8); // G
        
        time += 1;
        
        // Второй аккорд - D минор (D, F, A)
        playNote(audioCtx, masterGain, jazzScale[1], time, 0.8); // D
        playNote(audioCtx, masterGain, jazzScale[3], time + 0.05, 0.8); // F
        playNote(audioCtx, masterGain, jazzScale[5], time + 0.1, 0.8); // A
        
        time += 1;
        
        // Третий аккорд - G7 (G, B, D, F)
        playNote(audioCtx, masterGain, jazzScale[4], time, 0.8); // G
        playNote(audioCtx, masterGain, jazzScale[6], time + 0.05, 0.8); // B
        playNote(audioCtx, masterGain, jazzScale[1], time + 0.1, 0.8); // D
        playNote(audioCtx, masterGain, jazzScale[3], time + 0.15, 0.8); // F
        
        time += 1;
        
        // Четвертый аккорд - C мажор (C, E, G)
        playNote(audioCtx, masterGain, jazzScale[0], time, 1.2); // C
        playNote(audioCtx, masterGain, jazzScale[2], time + 0.05, 1.2); // E
        playNote(audioCtx, masterGain, jazzScale[4], time + 0.1, 1.2); // G
        
        addLog('Джазовая последовательность воспроизводится');
        
        // Возвращаем общую длительность последовательности
        return 4; // 4 секунды
      };
      
      // Создаем объект-замыкание, который будет хранить наш аудиоконтекст
      const audioEngine = {
        audioCtx: null as AudioContext | null,
        masterGain: null as GainNode | null,
        isPlaying: false,
        sequenceLength: 0,
        loopTimeout: null as NodeJS.Timeout | null,
        
        // Функция для воспроизведения
        play: function() {
          if (!this.audioCtx) {
            const webAudio = initializeWebAudio();
            if (!webAudio) return false;
            
            this.audioCtx = webAudio.audioContext;
            this.masterGain = webAudio.masterGain;
          }
          
          // Запускаем последовательность
          this.sequenceLength = playJazzSequence(this.audioCtx, this.masterGain!);
          this.isPlaying = true;
          
          // Настраиваем повторение
          this.loopTimeout = setTimeout(() => {
            if (this.isPlaying) {
              this.play();
            }
          }, this.sequenceLength * 1000);
          
          return true;
        },
        
        // Функция для остановки
        stop: function() {
          this.isPlaying = false;
          
          // Очищаем таймаут
          if (this.loopTimeout) {
            clearTimeout(this.loopTimeout);
            this.loopTimeout = null;
          }
          
          // Останавливаем все осцилляторы
          oscillators.forEach(({ osc, gain }) => {
            try {
              gain.gain.value = 0;
              osc.stop();
              osc.disconnect();
              gain.disconnect();
            } catch (e) {
              // Игнорируем возможные ошибки при остановке
            }
          });
          
          oscillators.length = 0;
          
          return true;
        }
      };
      
      // Сохраняем как audioElement для использования в компоненте
      setAudioElement(audioEngine as any);
      
      return () => {
        // Очистка при размонтировании
        if (audioEngine && audioEngine.isPlaying) {
          audioEngine.stop();
          addLog('Аудио остановлено при размонтировании компонента');
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
      // Web Audio API объект
      const audioEngine = audioElement as any;
      
      if (isPlaying) {
        addLog('Остановка Web Audio API');
        audioEngine.stop();
        setIsPlaying(false);
        addLog('Джазовая последовательность остановлена');
      } else {
        addLog('Запуск Web Audio API');
        const result = audioEngine.play();
        if (result) {
          setIsPlaying(true);
          addLog('Джазовая последовательность запущена');
        } else {
          addLog('Не удалось запустить Web Audio API');
          setLoadingError('Не удалось запустить Web Audio API');
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