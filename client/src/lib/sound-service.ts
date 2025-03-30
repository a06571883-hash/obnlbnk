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
const sounds: Partial<Record<SoundType, HTMLAudioElement>> = {};

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
      const silentSound = sounds.silent;
      if (silentSound) {
        await silentSound.play();
        console.log('Звуки успешно загружены');
      } else {
        console.log('Тихий звук еще не загружен');
      }
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
      // Если звук не найден, создаем его заново
      const audio = new Audio();
      audio.preload = 'auto';
      const path = soundFiles[soundName];
      audio.src = path.startsWith('/') ? path : `/${path}`;
      sounds[soundName] = audio;
      console.log(`Звук ${soundName} не был найден, пробуем загрузить заново`);
      return; // Выходим, чтобы дать возможность звуку загрузиться
    }

    // Пробуем воспроизвести звук
    try {
      sound.currentTime = 0;
      sound.volume = 0.3; // Снижаем громкость
      await sound.play();
    } catch (playError) {
      // Игнорируем ошибки воспроизведения, чтобы не спамить консоль
      if (playError instanceof Error && playError.name === 'NotAllowedError') {
        // Ошибка из-за политики автовоспроизведения, это нормально
      } else {
        console.log(`Не удалось воспроизвести звук ${soundName}`);
      }
    }
  } catch (error) {
    // Тихо игнорируем ошибки звука, чтобы они не мешали работе приложения
  }
};

// Функция для воспроизведения звука с проверкой состояния
export const playSoundIfEnabled = (soundName: SoundType) => {
  // Проверяем, включены ли звуки
  try {
    if (isSoundEnabled()) {
      // Вызываем функцию воспроизведения звука без вывода ошибок
      playSound(soundName).catch(() => {});
    }
  } catch (e) {
    // Игнорируем любые ошибки
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