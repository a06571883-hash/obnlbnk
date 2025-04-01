/**
 * Скрипт для создания аудиофайла с джазовой музыкой
 * через программную генерацию WAV-файла
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_RATE = 44100;
const BIT_DEPTH = 16;
const CHANNELS = 2;

// Путь для сохранения файла
const outputPath = path.join(__dirname, 'public', 'music');
const outputFile = path.join(outputPath, 'jazz_composition.wav');

/**
 * Создает WAV заголовок для аудиофайла
 */
function createWavHeader(dataLength) {
  const buffer = Buffer.alloc(44);
  
  // RIFF идентификатор
  buffer.write('RIFF', 0);
  
  // Размер файла
  buffer.writeUInt32LE(dataLength + 36, 4);
  
  // WAVE идентификатор
  buffer.write('WAVE', 8);
  
  // fmt идентификатор
  buffer.write('fmt ', 12);
  
  // Длина fmt секции
  buffer.writeUInt32LE(16, 16);
  
  // Аудио формат (1 - PCM)
  buffer.writeUInt16LE(1, 20);
  
  // Количество каналов
  buffer.writeUInt16LE(CHANNELS, 22);
  
  // Частота дискретизации
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  
  // Битрейт
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * BIT_DEPTH / 8, 28);
  
  // Размер блока
  buffer.writeUInt16LE(CHANNELS * BIT_DEPTH / 8, 32);
  
  // Битовая глубина
  buffer.writeUInt16LE(BIT_DEPTH, 34);
  
  // data идентификатор
  buffer.write('data', 36);
  
  // Размер данных
  buffer.writeUInt32LE(dataLength, 40);
  
  return buffer;
}

/**
 * Генерирует синусоидальный сигнал указанной частоты и длительности
 */
function generateSineWave(frequency, durationSec) {
  const numSamples = Math.floor(durationSec * SAMPLE_RATE);
  const audioData = Buffer.alloc(numSamples * CHANNELS * BIT_DEPTH / 8);
  
  for (let i = 0; i < numSamples; i++) {
    const sampleTime = i / SAMPLE_RATE;
    const sampleValue = Math.sin(2 * Math.PI * frequency * sampleTime);
    
    // Конвертируем значение [-1, 1] в значение для 16-битного PCM формата [-32768, 32767]
    const value = Math.floor(sampleValue * 32767);
    
    // Записываем значение для левого и правого канала
    for (let channel = 0; channel < CHANNELS; channel++) {
      const bufferPos = i * CHANNELS * BIT_DEPTH / 8 + channel * BIT_DEPTH / 8;
      audioData.writeInt16LE(value, bufferPos);
    }
  }
  
  return audioData;
}

/**
 * Генерирует аккорд из нескольких частот
 */
function generateChord(frequencies, durationSec, volume = 1.0) {
  const numSamples = Math.floor(durationSec * SAMPLE_RATE);
  const audioData = Buffer.alloc(numSamples * CHANNELS * BIT_DEPTH / 8);
  
  for (let i = 0; i < numSamples; i++) {
    const sampleTime = i / SAMPLE_RATE;
    let sampleValue = 0;
    
    // Суммируем все частоты для создания аккорда
    for (const freq of frequencies) {
      sampleValue += Math.sin(2 * Math.PI * freq * sampleTime) / frequencies.length;
    }
    
    // Применяем огибающую ADSR (Attack, Decay, Sustain, Release)
    const attack = 0.1; // 10% времени
    const decay = 0.1; // 10% времени
    const sustain = 0.5; // 50% от максимальной амплитуды
    const release = 0.2; // 20% времени
    
    let envelope = 1.0;
    const normalizedTime = sampleTime / durationSec;
    
    if (normalizedTime < attack) {
      // Фаза Attack - нарастание
      envelope = normalizedTime / attack;
    } else if (normalizedTime < attack + decay) {
      // Фаза Decay - спад до уровня Sustain
      const decayProgress = (normalizedTime - attack) / decay;
      envelope = 1.0 - (1.0 - sustain) * decayProgress;
    } else if (normalizedTime < 1.0 - release) {
      // Фаза Sustain - постоянный уровень
      envelope = sustain;
    } else {
      // Фаза Release - затухание
      const releaseProgress = (normalizedTime - (1.0 - release)) / release;
      envelope = sustain * (1.0 - releaseProgress);
    }
    
    // Применяем огибающую и громкость
    sampleValue = sampleValue * envelope * volume;
    
    // Конвертируем значение [-1, 1] в значение для 16-битного PCM [-32768, 32767]
    const value = Math.floor(sampleValue * 32767);
    
    // Записываем значение для левого и правого канала
    for (let channel = 0; channel < CHANNELS; channel++) {
      const bufferPos = i * CHANNELS * BIT_DEPTH / 8 + channel * BIT_DEPTH / 8;
      audioData.writeInt16LE(value, bufferPos);
    }
  }
  
  return audioData;
}

/**
 * Создает ритмический джазовый паттерн из нескольких аккордов
 */
function createJazzPattern() {
  // Джазовые ноты и аккорды
  const jazzChords = [
    // C Major 7 (C E G B)
    [261.63, 329.63, 392.00, 493.88],
    // F Major 7 (F A C E)
    [349.23, 440.00, 523.25, 659.25],
    // G Dominant 7 (G B D F)
    [392.00, 493.88, 587.33, 349.23],
    // A Minor 7 (A C E G)
    [440.00, 523.25, 659.25, 392.00],
    // D Minor 7 (D F A C)
    [293.66, 349.23, 440.00, 523.25],
    // E7 (E G# B D)
    [329.63, 415.30, 493.88, 587.33]
  ];
  
  // Создаем последовательность аккордов для джазовой композиции
  const patternBuffers = [];
  const totalDuration = 30; // 30 секунд композиции
  let currentTime = 0;
  
  while (currentTime < totalDuration) {
    // Выбираем случайный аккорд из списка
    const chord = jazzChords[Math.floor(Math.random() * jazzChords.length)];
    
    // Генерируем аккорд с разной длительностью и громкостью
    const duration = 0.5 + Math.random() * 1.5; // от 0.5 до 2 секунд
    const volume = 0.7 + Math.random() * 0.3; // от 0.7 до 1.0
    
    // Генерируем аккорд и добавляем его в список
    patternBuffers.push(generateChord(chord, duration, volume));
    
    currentTime += duration;
  }
  
  // Соединяем все буферы в один
  const totalLength = patternBuffers.reduce((acc, buffer) => acc + buffer.length, 0);
  const combinedBuffer = Buffer.concat(patternBuffers, totalLength);
  
  return combinedBuffer;
}

/**
 * Главная функция для создания джазовой композиции
 */
function createJazzComposition() {
  try {
    console.log('Начинаем создание джазовой композиции...');
    
    // Создаем директорию для сохранения файла
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    // Генерируем аудиоданные
    const audioData = createJazzPattern();
    
    // Создаем WAV заголовок
    const header = createWavHeader(audioData.length);
    
    // Объединяем заголовок и аудиоданные
    const wavFile = Buffer.concat([header, audioData], header.length + audioData.length);
    
    // Записываем WAV файл
    fs.writeFileSync(outputFile, wavFile);
    
    console.log(`Джазовая композиция успешно создана: ${outputFile}`);
    console.log(`Размер файла: ${wavFile.length} байт`);
    
    return outputFile;
  } catch (error) {
    console.error('Ошибка при создании джазовой композиции:', error);
    return null;
  }
}

// Создаем джазовую композицию
createJazzComposition();