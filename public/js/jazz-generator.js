// Скрипт для программного создания джазового аудио
const fs = require('fs');
const { execSync } = require('child_process');

// Создаем текстовый файл с командами для SoX
const createSoxScript = () => {
  // Базовый шаблон для создания джазовой мелодии
  const soxCommands = `
    # Создаем фоновый аккорд (синусоидальная волна)
    sox -n -r 44100 -b 16 chord.wav synth 10 sine 261.63 sine 329.63 sine 392.00 fade q 0.1 10 0.1

    # Создаем басовую линию
    sox -n -r 44100 -b 16 bass.wav synth 10 sine 110 sine 130.81 sine 146.83 fade q 0.1 10 0.1

    # Создаем пианино
    sox -n -r 44100 -b 16 piano1.wav synth 1 sine 261.63 fade q 0.1 1 0.1
    sox -n -r 44100 -b 16 piano2.wav synth 1 sine 329.63 fade q 0.1 1 0.1
    sox -n -r 44100 -b 16 piano3.wav synth 1 sine 392.00 fade q 0.1 1 0.1
    sox -n -r 44100 -b 16 piano4.wav synth 1 sine 440.00 fade q 0.1 1 0.1

    # Комбинируем все в один файл
    sox -m chord.wav bass.wav jazz_base.wav
    sox jazz_base.wav piano1.wav piano2.wav piano3.wav piano4.wav jazz_full.wav

    # Конвертируем в MP3
    sox jazz_full.wav -C 64 jazz_output.mp3

    # Очистка временных файлов
    rm chord.wav bass.wav piano1.wav piano2.wav piano3.wav piano4.wav jazz_base.wav jazz_full.wav
  `;

  fs.writeFileSync('create_jazz.sh', soxCommands);
  console.log('Created SoX script for jazz generation');
};

// Генерация синусоидальной волны (простой альтернативный подход)
const generateSineWave = (freq, duration, sampleRate = 44100) => {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    samples[i] = Math.sin(2 * Math.PI * freq * t);
  }
  
  return samples;
};

// Создание HTML5 аудио файла с генерируемой музыкой
const createHtmlAudio = () => {
  // Создаем простой HTML файл, который генерирует джаз в браузере
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Jazz Generator</title>
</head>
<body>
  <h1>Jazz Audio Generator</h1>
  <button id="generateBtn">Generate Jazz</button>
  <audio id="audioPlayer" controls></audio>

  <script>
    // Web Audio API для создания джазовой музыки
    document.getElementById('generateBtn').addEventListener('click', function() {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const masterGain = audioContext.createGain();
      masterGain.gain.value = 0.1;
      masterGain.connect(audioContext.destination);
      
      // Ноты в джазовой последовательности
      const notes = [
        { freq: 261.63, duration: 1 },  // C
        { freq: 293.66, duration: 0.5 }, // D
        { freq: 329.63, duration: 0.5 }, // E
        { freq: 349.23, duration: 1 },  // F
        { freq: 392.00, duration: 0.5 }, // G
        { freq: 440.00, duration: 0.5 }, // A
        { freq: 493.88, duration: 1 },  // B
        { freq: 523.25, duration: 2 },  // C (октава выше)
      ];
      
      // Создаем аккорды и мелодию
      let currentTime = audioContext.currentTime;
      
      notes.forEach(note => {
        // Основной тон
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = note.freq;
        
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.1;
        gainNode.gain.linearRampToValueAtTime(0, currentTime + note.duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(masterGain);
        
        oscillator.start(currentTime);
        oscillator.stop(currentTime + note.duration);
        
        // Гармоника (терция)
        const harmonic = audioContext.createOscillator();
        harmonic.type = 'sine';
        harmonic.frequency.value = note.freq * 1.25; // Мажорная терция
        
        const harmonicGain = audioContext.createGain();
        harmonicGain.gain.value = 0.05;
        harmonicGain.gain.linearRampToValueAtTime(0, currentTime + note.duration);
        
        harmonic.connect(harmonicGain);
        harmonicGain.connect(masterGain);
        
        harmonic.start(currentTime);
        harmonic.stop(currentTime + note.duration);
        
        currentTime += note.duration;
      });
      
      // Запись и проигрывание
      const recording = new MediaRecorder(audioContext.destination.stream);
      const chunks = [];
      
      recording.ondataavailable = function(e) {
        chunks.push(e.data);
      };
      
      recording.onstop = function() {
        const blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
        const audioURL = URL.createObjectURL(blob);
        document.getElementById('audioPlayer').src = audioURL;
      };
      
      recording.start();
      setTimeout(() => recording.stop(), currentTime * 1000 + 500);
    });
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync('jazz_generator.html', htmlContent);
  console.log('Created HTML5 audio generator');
};

// Создание простого аудиофайла для тестирования
const createSimpleAudioFile = () => {
  // Создаем мелодию из нескольких синусоидальных волн
  const melody = [
    { freq: 261.63, duration: 0.5 }, // C4
    { freq: 293.66, duration: 0.5 }, // D4
    { freq: 329.63, duration: 0.5 }, // E4
    { freq: 349.23, duration: 0.5 }, // F4
    { freq: 392.00, duration: 0.5 }, // G4
    { freq: 349.23, duration: 0.5 }, // F4
    { freq: 329.63, duration: 0.5 }, // E4
    { freq: 293.66, duration: 0.5 }, // D4
    { freq: 261.63, duration: 1.0 }, // C4
  ];
  
  // Общая длительность
  const totalDuration = melody.reduce((sum, note) => sum + note.duration, 0);
  const sampleRate = 44100;
  const totalSamples = Math.floor(totalDuration * sampleRate);
  
  // Создаем буфер для аудиоданных
  const buffer = new Float32Array(totalSamples);
  
  // Заполняем буфер данными синусоидальных волн
  let currentSample = 0;
  melody.forEach(note => {
    const numSamples = Math.floor(note.duration * sampleRate);
    const amplitude = 0.5; // Громкость
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      buffer[currentSample + i] = amplitude * Math.sin(2 * Math.PI * note.freq * t);
    }
    
    currentSample += numSamples;
  });
  
  // Выводим в файл (в формате WAV)
  // Примечание: Создание WAV напрямую в Node.js достаточно сложно, поэтому здесь только псевдокод
  console.log('Generated audio data of length:', buffer.length);
  
  // Запись в текстовый файл для тестирования
  const bufferStr = buffer.slice(0, 100).join(',');
  fs.writeFileSync('audio_samples.txt', bufferStr);
  console.log('Saved first 100 audio samples to audio_samples.txt');
  
  // В реальном сценарии сохранение аудио требует библиотек вроде node-wav или ffmpeg
  console.log('For actual WAV/MP3 creation, you would need to use a library like node-wav or execute ffmpeg');
};

// Запуск функций
try {
  //createSoxScript();
  //createHtmlAudio();
  createSimpleAudioFile();
  console.log('Done! Audio generation files created.');
} catch (error) {
  console.error('Error generating audio files:', error);
}