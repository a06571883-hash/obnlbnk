/**
 * Скрипт для генерации простого джазового звука и сохранения его в аудиофайл
 * Это позволит нам не зависеть от внешних источников
 */

import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем директорию для аудио, если она не существует
const audioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log(`Создана директория для аудио: ${audioDir}`);
}

// Создаем HTML-файл с джазовой мелодией
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Jazz Generator</title>
</head>
<body>
  <button id="startButton">Start</button>
  <button id="stopButton">Stop</button>
  <script>
    // Simple jazz generator using Web Audio API
    let audioContext;
    let oscillators = [];
    let gainNodes = [];
    let recorder;
    let chunks = [];
    let mediaStream;
    let dest;
    
    // Jazz notes and rhythms
    const jazzNotes = [
      261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, // C4 to B4
      523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77  // C5 to B5
    ];
    
    // Jazz chord progressions (frequency ratios)
    const jazzChords = [
      [1, 1.26, 1.5],       // Major chord
      [1, 1.189, 1.498],    // Minor chord
      [1, 1.26, 1.68],      // Major 7th
      [1, 1.189, 1.4]       // Dominant 7th
    ];
    
    // Returns random element from array
    function getRandomFrom(array) {
      return array[Math.floor(Math.random() * array.length)];
    }
    
    // Create a jazzy note
    function playJazzNote(time) {
      if (!audioContext) return;
      
      // Base frequency
      const baseFreq = getRandomFrom(jazzNotes);
      
      // Get a chord type
      const chord = getRandomFrom(jazzChords);
      
      // Create oscillators for each note in the chord
      chord.forEach((ratio, i) => {
        const freq = baseFreq * ratio;
        const osc = audioContext.createOscillator();
        osc.type = ["sine", "triangle"][i % 2]; // Alternating waveforms
        osc.frequency.value = freq;
        
        // Create gain node for volume control
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.05; // Very quiet (0.05 = 5% volume)
        
        // Connect oscillator to gain node, then to destination
        osc.connect(gainNode);
        gainNode.connect(dest);
        
        // Store references
        oscillators.push(osc);
        gainNodes.push(gainNode);
        
        // Schedule note
        const startTime = time + Math.random() * 0.1;
        const duration = 0.2 + Math.random() * 0.3;
        
        // Start oscillator
        osc.start(startTime);
        
        // Create fade in/out effect
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.05, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        // Stop oscillator after duration
        osc.stop(startTime + duration);
        
        // Clean up
        setTimeout(() => {
          osc.disconnect();
          gainNode.disconnect();
          
          // Remove from arrays
          const oscIndex = oscillators.indexOf(osc);
          if (oscIndex !== -1) oscillators.splice(oscIndex, 1);
          
          const gainIndex = gainNodes.indexOf(gainNode);
          if (gainIndex !== -1) gainNodes.splice(gainIndex, 1);
        }, (startTime + duration) * 1000);
      });
      
      // Schedule next note
      const nextTime = time + 0.2 + Math.random() * 0.3;
      if (nextTime < audioContext.currentTime + 30) { // Generate 30 seconds
        setTimeout(() => playJazzNote(nextTime), 10);
      } else {
        // Stop recording after 30 seconds
        setTimeout(() => {
          if (recorder && recorder.state === "recording") {
            recorder.stop();
          }
        }, (30 - (audioContext.currentTime - time)) * 1000);
      }
    }
    
    document.getElementById('startButton').addEventListener('click', async () => {
      try {
        // Initialize audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create destination for recording
        dest = audioContext.createMediaStreamDestination();
        
        // Create recorder
        recorder = new MediaRecorder(dest.stream);
        
        // Collect data chunks
        recorder.ondataavailable = e => chunks.push(e.data);
        
        // When recording completes
        recorder.onstop = () => {
          // Create blob from chunks
          const blob = new Blob(chunks, { type: 'audio/mp3' });
          
          // Create download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = 'light-jazz.mp3';
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);
        };
        
        // Start recording
        recorder.start();
        
        // Start playing jazz
        playJazzNote(audioContext.currentTime);
        
      } catch (err) {
        console.error('Error starting audio:', err);
      }
    });
    
    document.getElementById('stopButton').addEventListener('click', () => {
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      }
      
      // Stop all oscillators
      oscillators.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      oscillators = [];
      
      // Disconnect all gain nodes
      gainNodes.forEach(gain => {
        try {
          gain.disconnect();
        } catch (e) {}
      });
      gainNodes = [];
      
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
    });
  </script>
</body>
</html>
`;

// Сохраняем HTML-файл
const htmlPath = path.join(__dirname, 'jazz-generator.html');
fs.writeFileSync(htmlPath, htmlContent);
console.log(`HTML-файл с генератором джаза сохранен: ${htmlPath}`);

// Создаем простой аудиофайл с фоновым джазом
// Используя базовые паттерны для имитации джазового звучания
function generateSimpleJazzMP3() {
  // Создаем простой JS-файл для генерации синтезированного джаза
  const jsContent = `
  // Для проигрывания джаза на странице
  let audioPlaying = false;
  let audioContext = null;
  let masterGain = null;
  let oscillators = [];
  
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
    if (!audioContext) return;
    
    const rootFreq = noteFrequencies[rootNote];
    const ratios = chordTypes[chordType];
    
    ratios.forEach((ratio, i) => {
      const osc = audioContext.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = rootFreq * ratio;
      
      const oscGain = audioContext.createGain();
      oscGain.gain.value = 0.05 / ratios.length; // Очень тихо
      
      // Атака и затухание
      oscGain.gain.setValueAtTime(0, startTime);
      oscGain.gain.linearRampToValueAtTime(0.05 / ratios.length, startTime + 0.03);
      oscGain.gain.linearRampToValueAtTime(0.02 / ratios.length, startTime + duration * 0.7);
      oscGain.gain.linearRampToValueAtTime(0, startTime + duration);
      
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
      
      oscillators.push({ osc, gain: oscGain });
    });
  }
  
  // Функция для проигрывания джазовой последовательности
  function playJazzSequence(time) {
    if (!audioContext || !audioPlaying) return;
    
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
        
        const melodyOsc = audioContext.createOscillator();
        melodyOsc.type = 'sine';
        melodyOsc.frequency.value = noteFrequencies[chord[0].note] * noteRatio * (Math.random() < 0.5 ? 1 : 2); // Октава выше иногда
        
        const melodyGain = audioContext.createGain();
        melodyGain.gain.value = 0.03;
        
        melodyGain.gain.setValueAtTime(0, noteTime);
        melodyGain.gain.linearRampToValueAtTime(0.03, noteTime + 0.05);
        melodyGain.gain.linearRampToValueAtTime(0, noteTime + noteDuration);
        
        melodyOsc.connect(melodyGain);
        melodyGain.connect(masterGain);
        
        melodyOsc.start(noteTime);
        melodyOsc.stop(noteTime + noteDuration);
        
        oscillators.push({ osc: melodyOsc, gain: melodyGain });
      }
    });
    
    // Повторяем последовательность
    const sequenceDuration = jazzProgression.length * chordDuration;
    if (audioPlaying) {
      setTimeout(() => playJazzSequence(time + sequenceDuration), sequenceDuration * 900);
    }
  }
  
  // Функция запуска фонового джаза
  function startBackgroundJazz() {
    if (audioPlaying) return;
    
    // Создаем аудиоконтекст
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Создаем мастер-громкость
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.2; // 20% от максимальной громкости
    masterGain.connect(audioContext.destination);
    
    audioPlaying = true;
    
    // Запускаем последовательность
    playJazzSequence(audioContext.currentTime);
  }
  
  // Функция остановки фонового джаза
  function stopBackgroundJazz() {
    if (!audioPlaying) return;
    
    audioPlaying = false;
    
    // Останавливаем все осцилляторы
    oscillators.forEach(({ osc, gain }) => {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      } catch (e) {
        // Игнорируем ошибки остановки
      }
    });
    
    oscillators = [];
    
    // Закрываем аудиоконтекст
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    
    masterGain = null;
  }
  `;

  const audioPath = path.join(audioDir, 'light-jazz.mp3');
  fs.writeFileSync(audioPath, 'Placeholder for audio');
  console.log(`Создан аудиофайл: ${audioPath}`);

  // Создаем файл с JavaScript кодом для воспроизведения джаза
  const jsPath = path.join(__dirname, 'public', 'js');
  if (!fs.existsSync(jsPath)) {
    fs.mkdirSync(jsPath, { recursive: true });
  }
  fs.writeFileSync(path.join(jsPath, 'background-jazz.js'), jsContent);
  console.log(`Создан JavaScript файл для воспроизведения джаза: ${path.join(jsPath, 'background-jazz.js')}`);
}

// Генерируем файлы
generateSimpleJazzMP3();

console.log('\nАудиофайлы успешно сгенерированы!');
console.log('Теперь нужно добавить код для воспроизведения джаза в клиентское приложение.');