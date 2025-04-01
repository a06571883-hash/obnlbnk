import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import { isTelegramWebApp } from '../lib/telegram-utils';
import { isJazzEnabled, toggleJazz } from '../lib/sound-service';

// Единый компонент управления фоновой музыкой для Telegram WebApp
// Использует Web Audio API для генерации джазовой музыки без использования файлов
const TelegramMusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTelegramApp, setIsTelegramApp] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<{osc: OscillatorNode, gain: GainNode}[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  
  useEffect(() => {
    // Проверяем, запущено ли приложение в Telegram WebApp
    setIsTelegramApp(isTelegramWebApp());
    
    // Если это не Telegram WebApp, ничего не делаем
    if (!isTelegramWebApp()) return;
    
    // Отмечаем, что компонент инициализирован
    isInitializedRef.current = true;
    
    // Проверяем состояние музыки из localStorage
    const enabled = isJazzEnabled();
    setIsPlaying(enabled);
    
    // Если музыка должна играть - инициализируем и запускаем
    if (enabled) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
          console.log('Автоматически создан AudioContext');
        }
        
        // Запускаем музыку с небольшой задержкой для инициализации
        setTimeout(() => {
          if (isInitializedRef.current && enabled) {
            playJazzProgression();
            console.log('Автозапуск джазовой последовательности');
          }
        }, 1000);
      } catch (error) {
        console.error('Ошибка при автозапуске музыки:', error);
      }
    }
    
    // Для очистки ресурсов при размонтировании компонента
    return () => {
      stopAllOscillators();
      
      // Закрываем аудиоконтекст
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      
      isInitializedRef.current = false;
    };
  }, []);
  
  // Функция для остановки всех осцилляторов
  const stopAllOscillators = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    oscillatorsRef.current.forEach(({ osc, gain }) => {
      try {
        // Быстро снижаем громкость до нуля
        const currentTime = audioContextRef.current?.currentTime || 0;
        gain.gain.cancelScheduledValues(currentTime);
        gain.gain.setValueAtTime(gain.gain.value, currentTime);
        gain.gain.linearRampToValueAtTime(0, currentTime + 0.1);
        
        // Останавливаем через небольшой промежуток времени
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch (e) {
            // Игнорируем ошибки при остановке
          }
        }, 110);
      } catch (e) {
        // Игнорируем ошибки при остановке
      }
    });
    
    // Очищаем массив осцилляторов
    oscillatorsRef.current = [];
  };
  
  // Функция для воспроизведения ноты с очень тихой громкостью
  const playNote = (frequency: number, startTime: number, duration: number) => {
    if (!audioContextRef.current) return;
    
    try {
      // Создаем осциллятор
      const oscillator = audioContextRef.current.createOscillator();
      oscillator.type = 'sine'; // Синусоидальная волна для мягкого звука
      oscillator.frequency.value = frequency;
      
      // Создаем узел усиления для контроля громкости
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0;
      
      // Настраиваем очень тихую громкость (0.01 - 1% от максимума)
      // и плавное затухание для мягкого звучания
      const now = startTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.02); // Быстрая атака, низкая громкость
      gainNode.gain.linearRampToValueAtTime(0.007, now + duration * 0.7); // Затухание
      gainNode.gain.linearRampToValueAtTime(0, now + duration); // Плавное окончание
      
      // Подключаем осциллятор к узлу усиления
      oscillator.connect(gainNode);
      
      // Подключаем узел усиления к выходу
      gainNode.connect(audioContextRef.current.destination);
      
      // Запускаем осциллятор
      oscillator.start(now);
      oscillator.stop(now + duration);
      
      // Добавляем в список для возможности остановки
      oscillatorsRef.current.push({ osc: oscillator, gain: gainNode });
    } catch (error) {
      console.error('Ошибка при воспроизведении ноты:', error);
    }
  };
  
  // Джазовая прогрессия (очень тихая)
  const playJazzProgression = () => {
    if (!audioContextRef.current || !isInitializedRef.current) return;
    
    try {
      const now = audioContextRef.current.currentTime;
      
      // C major (C-E-G)
      playNote(261.63, now, 0.8);        // C4
      playNote(329.63, now + 0.03, 0.8); // E4
      playNote(392.00, now + 0.06, 0.8); // G4
      
      // Dm (D-F-A)
      playNote(293.66, now + 1, 0.8);      // D4
      playNote(349.23, now + 1.03, 0.8);   // F4
      playNote(440.00, now + 1.06, 0.8);   // A4
      
      // G7 (G-B-D-F)
      playNote(392.00, now + 2, 0.8);      // G4
      playNote(493.88, now + 2.03, 0.8);   // B4
      playNote(587.33, now + 2.06, 0.8);   // D5
      playNote(349.23, now + 2.09, 0.8);   // F4
      
      // C major (C-E-G)
      playNote(261.63, now + 3, 1.0);      // C4
      playNote(329.63, now + 3.03, 1.0);   // E4
      playNote(392.00, now + 3.06, 1.0);   // G4
      
      // Запланируем следующее воспроизведение через 4 секунды
      // только если все еще в режиме воспроизведения
      if (isPlaying && isInitializedRef.current) {
        timeoutRef.current = setTimeout(() => {
          playJazzProgression();
        }, 4000);
      }
    } catch (error) {
      console.error('Ошибка при воспроизведении джазовой последовательности:', error);
    }
  };
  
  // Функция для переключения воспроизведения музыки
  const toggleMusic = () => {
    if (isPlaying) {
      // Остановка воспроизведения
      stopAllOscillators();
      setIsPlaying(false);
      console.log('Музыка остановлена');
      
      // Сохраняем состояние в localStorage
      toggleJazz(false);
      
      // Приостанавливаем аудиоконтекст для экономии ресурсов
      if (audioContextRef.current?.state === 'running') {
        audioContextRef.current?.suspend().catch(console.error);
      }
    } else {
      try {
        // Создаем аудио контекст, если его еще нет
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
          console.log('Создан новый AudioContext');
        } else if (audioContextRef.current.state === 'suspended') {
          // Возобновляем контекст, если он был приостановлен
          audioContextRef.current.resume().catch(console.error);
        }
        
        // Запускаем джазовую последовательность
        setIsPlaying(true);
        playJazzProgression();
        
        // Сохраняем состояние в localStorage
        toggleJazz(true);
        
        console.log('Джазовая последовательность запущена');
      } catch (error) {
        console.error('Ошибка при включении музыки:', error);
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
        title={isPlaying ? "Выключить фоновую музыку" : "Включить фоновую музыку"}
      >
        {isPlaying ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </Button>
    </div>
  );
};

export default TelegramMusicPlayer;