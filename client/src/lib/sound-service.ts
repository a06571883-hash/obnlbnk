// Типы звуков, используемых в приложении
export type SoundType = 'click' | 'success' | 'error' | 'transfer' | 'notification';

// Пути к звуковым файлам
const soundFiles: Record<SoundType, string> = {
  click: '/sounds/click.mp3',
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
  transfer: '/sounds/transfer.mp3',
  notification: '/sounds/notification.mp3'
};

// Кэш для предзагруженных аудио файлов
const audioCache: Record<SoundType, HTMLAudioElement> = {} as Record<SoundType, HTMLAudioElement>;

/**
 * Инициализирует звуковой сервис
 * Предзагружает все звуки для быстрого воспроизведения
 */
export const initSoundService = (): void => {
  console.log('Initializing sound service...');

  // Проверяем поддержку Web Audio API
  if (typeof Audio === 'undefined') {
    console.warn('Audio не поддерживается в этом браузере');
    return;
  }

  try {
    // Предзагружаем все звуки
    Object.entries(soundFiles).forEach(([type, path]) => {
      loadSound(type as SoundType);
    });
  } catch (e) {
    console.error('Ошибка инициализации аудио:', e);
  }
};

/**
 * Load a sound file and cache it
 */
const loadSound = (type: SoundType): HTMLAudioElement => {
  if (!audioCache[type]) {
    const audio = new Audio(soundFiles[type]);
    audio.volume = 0.5; // Default volume
    audioCache[type] = audio;
  }
  return audioCache[type];
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
      const sound = loadSound(type);

      // Reset sound to beginning if it's already playing
      sound.currentTime = 0;

      // Play the sound
      sound.play().catch(e => {
        console.error(`Error playing sound ${type}:`, e);
      });
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