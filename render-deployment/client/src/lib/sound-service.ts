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
    // Загружаем звуки с правильными путями
    for (const [type, path] of Object.entries(soundFiles)) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = path.startsWith('/') ? path : `/${path}`;
      sounds[type as SoundType] = audio;

      audio.onerror = (e) => {
        console.error(`Ошибка загрузки звука ${type}:`, e);
      };
    }

    // Пробуем воспроизвести тихий звук после загрузки страницы
    try {
      await sounds.silent.play();
      console.log('Звуки успешно загружены');
    } catch (error) {
      console.log('Аудио будет доступно после взаимодействия с пользователем');
    }
  } catch (error) {
    console.error('Ошибка при загрузке звуков:', error);
  }
};

// Воспроизвести звук
export const playSound = async (soundName: SoundType) => {
  try {
    const sound = sounds[soundName];
    if (!sound) {
      console.warn(`Звук ${soundName} не найден`);
      return;
    }

    if (sound.readyState >= 2) {
      sound.currentTime = 0;
      sound.volume = 0.5;
      await sound.play();
    } else {
      console.log(`Звук ${soundName} еще загружается...`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      console.log('Звук будет доступен после взаимодействия с пользователем');
    } else {
      console.error(`Ошибка при воспроизведении звука ${soundName}:`, error);
    }
  }
};

// Функция для воспроизведения звука с проверкой состояния
export const playSoundIfEnabled = (soundName: SoundType) => {
  playSound(soundName).catch(console.error);
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