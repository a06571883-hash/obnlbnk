// Заглушка для звукового сервиса - звуки полностью отключены

export type SoundType = 'click' | 'buttonClick' | 'success' | 'error' | 'transfer' | 'notification' | 'silent';

// Предварительная загрузка звуков (пустая функция)
export const preloadSounds = async (): Promise<void> => {
  console.log('Звуковой сервис отключен, preloadSounds - заглушка');
};

// Воспроизвести звук (пустая функция - ничего не делает)
export const playSound = async (soundName: SoundType): Promise<void> => {
  // Звуки отключены
};

// Функция для воспроизведения звука с проверкой состояния
export const playSoundIfEnabled = (soundName: SoundType): void => {
  // Звуки отключены
};

// Инициализирует звуковой сервис
export const initSoundService = async (): Promise<void> => {
  console.log('Звуковой сервис отключен');
};

// Проверяет, включены ли звуки в настройках
export const isSoundEnabled = (): boolean => {
  return false; // Звуки всегда отключены
};

// Проверяет, включен ли фоновый джаз
export const isJazzEnabled = (): boolean => {
  return false; // Джаз всегда отключен
};

// Включает или выключает звуки
export const toggleSound = (enabled: boolean): void => {
  // Звуки отключены
};

// Включает или выключает фоновый джаз
export const toggleJazz = (enabled: boolean): void => {
  // Джаз отключен
};
