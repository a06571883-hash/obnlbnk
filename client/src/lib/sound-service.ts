// Типы звуков, используемых в приложении
export type SoundType = 'click' | 'success' | 'error' | 'transfer' | 'notification' | 'silent';

// Пути к звуковым файлам
const soundFiles: Record<SoundType, string> = {
  click: '/sounds/click.mp3',
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
  transfer: '/sounds/transfer.mp3',
  notification: '/sounds/notification.mp3',
  silent: '/sounds/silent.mp3'
};

// Сервис для работы со звуками
const sounds: Record<SoundType, HTMLAudioElement> = {};

// Предварительная загрузка звуков
export const preloadSounds = async () => {
  try {
    // Загружаем звуки
    for (const [type, path] of Object.entries(soundFiles)) {
      sounds[type as SoundType] = new Audio(path);
    }

    // Для iOS требуется взаимодействие пользователя перед воспроизведением звука
    const playPromise = sounds.silent.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Аудио требует взаимодействия пользователя:', error);
      });
    }

    console.log('Звуки успешно загружены');
  } catch (error) {
    console.error('Ошибка при загрузке звуков:', error);
  }
};

// Воспроизвести звук
export const playSound = (soundName: SoundType) => {
  try {
    const sound = sounds[soundName];
    if (sound) {
      // Сбрасываем позицию воспроизведения на начало
      sound.currentTime = 0;
      // Начинаем воспроизведение
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error(`Ошибка воспроизведения звука ${soundName}:`, error);
        });
      }
    } else {
      console.warn(`Звук ${soundName} не найден`);
    }
  } catch (error) {
    console.error(`Ошибка при воспроизведении звука ${soundName}:`, error);
  }
};

/**
 * Инициализирует звуковой сервис
 * Предзагружает все звуки для быстрого воспроизведения
 */
export const initSoundService = async (): Promise<void> => {
  console.log('Initializing sound service...');

  // Проверяем поддержку Web Audio API
  if (typeof Audio === 'undefined') {
    console.warn('Audio не поддерживается в этом браузере');
    return;
  }

  try {
    await preloadSounds();
  } catch (e) {
    console.error('Ошибка инициализации аудио:', e);
  }
};


/**
 * Play a sound if enabled in user settings
 */
export const playSoundIfEnabled = (type: SoundType): void => {
  try {
    // Get sound settings from localStorage
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

    if (soundEnabled) {
      console.log(`Playing sound: ${type}`);
      playSound(type);
    }
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

/**
 * Проверяет, включены ли звуки в настройках
 */
export const isSoundEnabled = (): boolean => {
  try {
    return localStorage.getItem('soundEnabled') !== 'false';
  } catch (e) {
    console.error('Ошибка при проверке настроек звука:', e);
    return true; // По умолчанию включено
  }
};

/**
 * Включает или выключает звуки
 */
export const toggleSound = (enabled: boolean): void => {
  try {
    localStorage.setItem('soundEnabled', String(enabled));
    console.log(`Звуки ${enabled ? 'включены' : 'выключены'}`);
  } catch (e) {
    console.error('Ошибка при изменении настроек звука:', e);
  }
};