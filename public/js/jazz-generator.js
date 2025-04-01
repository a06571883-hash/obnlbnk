/**
 * Генератор джазовой музыки на основе Web Audio API
 * 
 * Создает плавные джазовые последовательности с использованием осцилляторов
 * вместо аудиофайлов. Полезно для Telegram WebApp, где воспроизведение 
 * аудиофайлов может работать некорректно.
 */

class JazzGenerator {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.oscillators = [];
    this.isPlaying = false;
    this.currentTimeout = null;
    this.maxVolume = 0.05; // Максимальная громкость (очень тихо)
  }

  /**
   * Инициализирует аудио контекст
   */
  init() {
    if (this.audioContext) return;
    
    try {
      // Создаем аудио контекст
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Создаем главный регулятор громкости
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.maxVolume;
      this.masterGain.connect(this.audioContext.destination);
      
      console.log('[JazzGenerator] Инициализация успешна');
      return true;
    } catch (error) {
      console.error('[JazzGenerator] Ошибка инициализации:', error);
      return false;
    }
  }

  /**
   * Создает и воспроизводит джазовую ноту
   */
  playNote(frequency, startTime, duration, type = 'sine') {
    try {
      if (!this.audioContext || !this.masterGain) return null;
      
      // Создаем осциллятор и регулятор громкости для ноты
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      // Настраиваем осциллятор
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      
      // Настраиваем регулятор громкости с плавным затуханием
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.linearRampToValueAtTime(0.2, startTime + duration * 0.5);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      
      // Подключаем осциллятор к регулятору громкости и главному выходу
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      
      // Запускаем осциллятор
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
      
      // Сохраняем ссылки на осциллятор и регулятор громкости
      const oscillatorRef = { osc: oscillator, gain: gain };
      this.oscillators.push(oscillatorRef);
      
      // Настраиваем автоматическое удаление из списка по окончании звучания
      setTimeout(() => {
        const index = this.oscillators.indexOf(oscillatorRef);
        if (index !== -1) {
          this.oscillators.splice(index, 1);
        }
      }, (startTime + duration - this.audioContext.currentTime) * 1000);
      
      return oscillatorRef;
    } catch (error) {
      console.error('[JazzGenerator] Ошибка при воспроизведении ноты:', error);
      return null;
    }
  }

  /**
   * Проигрывает джазовый аккорд
   */
  playChord(baseFrequency, startTime, duration, type = 'sine') {
    // Создаем джазовый аккорд из основной ноты и нескольких обертонов
    const intervals = [1, 1.5, 1.8, 2.0, 2.8]; // Джазовые интервалы
    
    intervals.forEach((interval, index) => {
      const frequency = baseFrequency * interval;
      const volume = index === 0 ? 0.3 : 0.3 / (index + 1);
      const noteStartTime = startTime + index * 0.03; // Небольшое смещение для более мягкого звучания
      
      this.playNote(frequency, noteStartTime, duration, type);
    });
  }

  /**
   * Проигрывает джазовую последовательность
   */
  playJazzSequence() {
    if (!this.audioContext) {
      if (!this.init()) return false;
    }
    
    // Джазовые ноты (частоты в герцах)
    const jazzNotes = [
      220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440,
      493.88, 523.25, 587.33, 659.25, 698.46, 783.99
    ];
    
    // Запускаем рекурсивное проигрывание джазовых аккордов
    const playNextChord = (index = 0) => {
      if (!this.isPlaying) return;
      
      const currentTime = this.audioContext.currentTime;
      const randomNote = jazzNotes[Math.floor(Math.random() * jazzNotes.length)];
      const duration = 2 + Math.random() * 2; // Длительность от 2 до 4 секунд
      const waitTime = duration * 0.7; // Следующий аккорд начинается до окончания текущего
      
      // Проигрываем аккорд
      this.playChord(randomNote, currentTime, duration, index % 2 === 0 ? 'sine' : 'triangle');
      
      // Планируем следующий аккорд
      this.currentTimeout = setTimeout(() => {
        playNextChord(index + 1);
      }, waitTime * 1000);
    };
    
    // Запускаем последовательность
    playNextChord();
    return true;
  }

  /**
   * Запускает воспроизведение джазовой последовательности
   */
  play() {
    if (this.isPlaying) return true;
    
    try {
      this.isPlaying = true;
      
      // Инициализируем аудио контекст, если еще не инициализирован
      if (!this.audioContext) {
        if (!this.init()) {
          this.isPlaying = false;
          return false;
        }
      } 
      // Возобновляем аудио контекст, если он был приостановлен
      else if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      // Запускаем джазовую последовательность
      this.playJazzSequence();
      console.log('[JazzGenerator] Воспроизведение запущено');
      return true;
    } catch (error) {
      console.error('[JazzGenerator] Ошибка при запуске:', error);
      this.isPlaying = false;
      return false;
    }
  }

  /**
   * Останавливает воспроизведение джазовой последовательности
   */
  stop() {
    this.isPlaying = false;
    
    // Останавливаем планирование следующих аккордов
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    
    // Останавливаем все активные осцилляторы
    this.stopAllOscillators();
    
    // Приостанавливаем аудио контекст
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
    
    console.log('[JazzGenerator] Воспроизведение остановлено');
  }

  /**
   * Останавливает все активные осцилляторы
   */
  stopAllOscillators() {
    const currentTime = this.audioContext ? this.audioContext.currentTime : 0;
    
    // Плавно отключаем все активные осцилляторы
    this.oscillators.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(currentTime);
        gain.gain.setValueAtTime(gain.gain.value, currentTime);
        gain.gain.linearRampToValueAtTime(0, currentTime + 0.1);
        
        // Полностью отключаем осциллятор через 0.1 секунду
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch (e) {
            // Игнорируем ошибки при отключении уже остановленных осцилляторов
          }
        }, 100);
      } catch (e) {
        console.error('[JazzGenerator] Ошибка при остановке осциллятора:', e);
      }
    });
    
    // Очищаем массив осцилляторов
    this.oscillators = [];
  }

  /**
   * Устанавливает громкость воспроизведения
   * @param {number} value - значение от 0 до 1
   */
  setVolume(value) {
    if (!this.masterGain) return;
    
    // Устанавливаем громкость не больше максимальной
    const volume = Math.min(value, this.maxVolume);
    
    try {
      const currentTime = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(currentTime);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, currentTime);
      this.masterGain.gain.linearRampToValueAtTime(volume, currentTime + 0.1);
      
      console.log(`[JazzGenerator] Громкость установлена: ${volume}`);
    } catch (error) {
      console.error('[JazzGenerator] Ошибка при изменении громкости:', error);
    }
  }
}

// Создаем глобальный экземпляр генератора джаза
window.jazzGenerator = new JazzGenerator();