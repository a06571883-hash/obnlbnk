
// Глобальные переменные для проигрывания джаза на странице
window.audioPlaying = false;
window.audioContext = null;
window.masterGain = null;
window.oscillators = [];
  
  // Джазовая прогрессия II-V-I в тональности C
  const jazzProgression = [
    [{ note: 'D', type: 'minor7' }],     // II-
    [{ note: 'G', type: 'dominant7' }],   // V7
    [{ note: 'C', type: 'major7' }],      // Imaj7
    [{ note: 'A', type: 'minor7' }]       // VI-
  ];
  
  // Частоты основных нот
  const noteFrequencies = {
    'C': 261.63,
    'C#': 277.18,
    'D': 293.66,
    'D#': 311.13,
    'E': 329.63,
    'F': 349.23,
    'F#': 369.99,
    'G': 392.00,
    'G#': 415.30,
    'A': 440.00,
    'A#': 466.16,
    'B': 493.88
  };
  
  // Коэффициенты для различных аккордов
  const chordTypes = {
    'major': [1, 1.26, 1.5],              // мажорное трезвучие
    'minor': [1, 1.189, 1.5],             // минорное трезвучие
    'major7': [1, 1.26, 1.5, 1.89],       // мажорный септаккорд
    'dominant7': [1, 1.26, 1.5, 1.78],    // доминантсептаккорд
    'minor7': [1, 1.189, 1.5, 1.78]       // минорный септаккорд
  };
  
// Функция для воспроизведения аккорда
function playChord(rootNote, chordType, startTime, duration) {
  if (!window.audioContext) return;
  
  const rootFreq = noteFrequencies[rootNote];
  const ratios = chordTypes[chordType];
  
  ratios.forEach((ratio, i) => {
    const osc = window.audioContext.createOscillator();
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.value = rootFreq * ratio;
    
    const oscGain = window.audioContext.createGain();
    oscGain.gain.value = 0.05 / ratios.length; // Очень тихо
    
    // Атака и затухание
    oscGain.gain.setValueAtTime(0, startTime);
    oscGain.gain.linearRampToValueAtTime(0.05 / ratios.length, startTime + 0.03);
    oscGain.gain.linearRampToValueAtTime(0.02 / ratios.length, startTime + duration * 0.7);
    oscGain.gain.linearRampToValueAtTime(0, startTime + duration);
    
    osc.connect(oscGain);
    oscGain.connect(window.masterGain);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
    
    window.oscillators.push({ osc, gain: oscGain });
  });
}

// Функция для проигрывания джазовой последовательности
function playJazzSequence(time) {
  if (!window.audioContext || !window.audioPlaying) return;
  
  const chordDuration = 2; // длительность аккорда
  
  jazzProgression.forEach((chord, index) => {
    const chordStartTime = time + index * chordDuration;
    
    // Воспроизводим аккорд
    playChord(chord[0].note, chord[0].type, chordStartTime, chordDuration - 0.1);
    
    // Генерируем случайные ноты для имитации мелодии
    for (let i = 0; i < 4; i++) {
      const noteTime = chordStartTime + i * 0.5;
      const noteDuration = 0.2 + Math.random() * 0.2;
      
      // Случайная нота из аккорда
      const noteIndex = Math.floor(Math.random() * chordTypes[chord[0].type].length);
      const noteRatio = chordTypes[chord[0].type][noteIndex];
      
      const melodyOsc = window.audioContext.createOscillator();
      melodyOsc.type = 'sine';
      melodyOsc.frequency.value = noteFrequencies[chord[0].note] * noteRatio * (Math.random() < 0.5 ? 1 : 2); // Октава выше иногда
      
      const melodyGain = window.audioContext.createGain();
      melodyGain.gain.value = 0.03;
      
      melodyGain.gain.setValueAtTime(0, noteTime);
      melodyGain.gain.linearRampToValueAtTime(0.03, noteTime + 0.05);
      melodyGain.gain.linearRampToValueAtTime(0, noteTime + noteDuration);
      
      melodyOsc.connect(melodyGain);
      melodyGain.connect(window.masterGain);
      
      melodyOsc.start(noteTime);
      melodyOsc.stop(noteTime + noteDuration);
      
      window.oscillators.push({ osc: melodyOsc, gain: melodyGain });
    }
  });
  
  // Повторяем последовательность
  const sequenceDuration = jazzProgression.length * chordDuration;
  if (window.audioPlaying) {
    setTimeout(() => playJazzSequence(time + sequenceDuration), sequenceDuration * 900);
  }
}
  
// Функция запуска фонового джаза (глобальная)
window.startBackgroundJazz = function() {
  if (window.audioPlaying) return;
  
  // Создаем аудиоконтекст
  window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Создаем мастер-громкость
  window.masterGain = window.audioContext.createGain();
  window.masterGain.gain.value = 0.1; // 10% от максимальной громкости (очень тихо)
  window.masterGain.connect(window.audioContext.destination);
  
  window.audioPlaying = true;
  
  // Запускаем последовательность
  playJazzSequence(window.audioContext.currentTime);
  
  console.log('Background jazz started');
}

// Функция остановки фонового джаза (глобальная)
window.stopBackgroundJazz = function() {
  if (!window.audioPlaying) return;
  
  window.audioPlaying = false;
  
  // Останавливаем все осцилляторы
  window.oscillators.forEach(({ osc, gain }) => {
    try {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
    } catch (e) {
      // Игнорируем ошибки остановки
    }
  });
  
  window.oscillators = [];
  
  // Закрываем аудиоконтекст
  if (window.audioContext) {
    window.audioContext.close();
    window.audioContext = null;
  }
  
  window.masterGain = null;
  console.log('Background jazz stopped');
}
  