
/**
 * Сервис для воспроизведения звуковых эффектов
 */

// Predefined sound types
export type SoundType = 'click' | 'transfer' | 'error' | 'success';

// Sound file mapping
const soundFiles: Record<SoundType, string> = {
  click: '/sounds/click.mp3',
  transfer: '/sounds/transfer.mp3',
  error: '/sounds/error.mp3',
  success: '/sounds/success.mp3'
};

// Audio instances cache
const audioCache: Record<string, HTMLAudioElement> = {};

/**
 * Preload all sounds to avoid delay on first play
 */
export const preloadSounds = (): void => {
  Object.entries(soundFiles).forEach(([type, path]) => {
    loadSound(type as SoundType);
  });
};

/**
 * Load a sound file into cache
 */
const loadSound = (type: SoundType): HTMLAudioElement => {
  if (!audioCache[type]) {
    try {
      const audio = new Audio(soundFiles[type]);
      audio.preload = 'auto';
      
      // Log when sound is loaded successfully
      audio.addEventListener('canplaythrough', () => {
        console.log(`Sound '${type}' loaded successfully`);
      });
      
      // Log errors in loading
      audio.addEventListener('error', (e) => {
        console.error(`Failed to load sound '${type}'`, e);
      });
      
      audioCache[type] = audio;
    } catch (error) {
      console.error(`Error creating audio for '${type}':`, error);
      // Create dummy audio to prevent errors
      audioCache[type] = new Audio();
    }
  }
  return audioCache[type];
};

/**
 * Play a sound effect
 */
export const playSound = (type: SoundType): void => {
  try {
    const audio = loadSound(type);
    
    // Reset the audio to beginning to allow rapid replay
    audio.currentTime = 0;
    
    // Start playback
    const playPromise = audio.play();
    
    // Handle play promise to avoid uncaught errors in console
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`Playing sound: ${type}`);
        })
        .catch(error => {
          console.error(`Sound playback failed for '${type}':`, error);
        });
    }
  } catch (error) {
    console.error(`Error playing sound '${type}':`, error);
  }
};

/**
 * Enable/disable sound effects
 */
let soundEnabled = true;

export const toggleSound = (): boolean => {
  soundEnabled = !soundEnabled;
  return soundEnabled;
};

export const isSoundEnabled = (): boolean => {
  return soundEnabled;
};

export const setSoundEnabled = (enabled: boolean): void => {
  soundEnabled = enabled;
};

// Export a wrapped version that checks if sound is enabled
export const playSoundIfEnabled = (type: SoundType): void => {
  if (soundEnabled) {
    playSound(type);
  }
};ndEnabled) {
    playSound(type);
  }
};
