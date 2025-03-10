/**
 * Тестовый скрипт для проверки обновленных функций валидации Bitcoin-адресов
 * - Проверяет, что адреса, начинающиеся с "11", корректно проходят валидацию
 * - Тестирует различные форматы Bitcoin-адресов на валидность
 */

import crypto from 'crypto';

// Функция проверки BTC-адреса с фронтенда
function validateBtcAddressFrontend(address) {
  // Обновленная регулярка для Legacy и P2SH, принимает все допустимые символы (включая повторяющиеся цифры)
  const legacyRegex = /^[13][a-km-zA-HJ-NP-Z0-9]{24,33}$/;
  // Регулярка для SegWit адресов (bc1...)
  const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
  
  // Проверяем дополнительно, чтобы отсечь явно некорректные адреса
  const hasInvalidPattern = address.includes('BTC') || 
                           address.includes('btc') || 
                           /^1[0-9]{6,}$/.test(address); // Предотвращаем адреса вида 1000000...
  
  return (legacyRegex.test(address) || bech32Regex.test(address)) && !hasInvalidPattern;
}

// Функция для генерации валидных BTC-адресов
function generateValidBtcAddress() {
  // Base58 символы, включая все цифры
  const VALID_CHARS = '0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  
  // Функция для генерации случайной строки с допустимыми символами
  function generateValidString(length) {
    let result = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      const randomIndex = bytes[i] % VALID_CHARS.length;
      result += VALID_CHARS.charAt(randomIndex);
    }
    
    return result;
  }
  
  // Создаем адрес в формате P2PKH, который будет соответствовать обновленным требованиям фронтенда
  const prefixChar = '1';
  const addressLength = 28; // В середине допустимого диапазона
  
  // Генерируем строку, но проверяем, что она не содержит запрещенные паттерны
  let addressBody = generateValidString(addressLength);
  while (
    addressBody.includes('BTC') || 
    addressBody.includes('btc') || 
    /^[0-9]+$/.test(addressBody) // Проверяем, что не состоит только из цифр
  ) {
    addressBody = generateValidString(addressLength);
  }
  
  return `${prefixChar}${addressBody}`;
}

// Генерация специального тестового адреса, начинающегося с "11"
function generateSpecialTestAddress() {
  // Base58 символы, включая все цифры
  const VALID_CHARS = '0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  
  // Функция для генерации случайной строки
  function generateValidString(length) {
    let result = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      const randomIndex = bytes[i] % VALID_CHARS.length;
      result += VALID_CHARS.charAt(randomIndex);
    }
    
    return result;
  }
  
  // Создаем специальный адрес, начинающийся с "11"
  const addressLength = 27; // Общая длина будет 29 символов (11 + 27 символов)
  const addressBody = generateValidString(addressLength);
  return `11${addressBody}`;
}

// Тестовые адреса
const testAddresses = [
  // Старые адреса
  "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", // Первый биткоин-адрес (Genesis block)
  "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", // Пример P2SH адреса
  "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", // Пример Bech32 адреса
  
  // Проблемные адреса
  "11QAZXSWedcvfr4322WSXZxsw", // Адрес, начинающийся с "11"
  "1100000000000000000000000", // Адрес, начинающийся с "11" и только с цифрами (невалидный)
  "1BTCadressshouldnotpass123", // Адрес с "BTC" (невалидный)
  
  // Новые тестовые адреса
  generateValidBtcAddress(),
  generateValidBtcAddress(),
  generateSpecialTestAddress(),
  generateSpecialTestAddress()
];

// Выполнение тестов
console.log("🔍 Тестирование валидации Bitcoin-адресов с обновленными правилами\n");

testAddresses.forEach(address => {
  const isValid = validateBtcAddressFrontend(address);
  console.log(`Адрес: ${address}`);
  console.log(`Длина: ${address.length} символов`);
  console.log(`Валидность: ${isValid ? '✅ Проходит валидацию' : '❌ Не проходит валидацию'}`);
  
  // Проверяем регулярные выражения отдельно
  const legacyRegex = /^[13][a-km-zA-HJ-NP-Z0-9]{24,33}$/;
  const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
  const hasInvalidPattern = address.includes('BTC') || address.includes('btc') || /^1[0-9]{6,}$/.test(address);
  
  console.log(`- Legacy Regex: ${legacyRegex.test(address) ? '✓' : '✗'}`);
  console.log(`- Bech32 Regex: ${bech32Regex.test(address) ? '✓' : '✗'}`);
  console.log(`- Недопустимый паттерн: ${hasInvalidPattern ? '✓ (найден)' : '✗ (не найден)'}`);
  console.log("----------------------------");
});

// Генерация и тестирование серии адресов, начинающихся с "11"
console.log("\n🧪 Тестирование серии адресов, начинающихся с '11':\n");

const specialTestCount = 5;
for (let i = 0; i < specialTestCount; i++) {
  const specialAddress = generateSpecialTestAddress();
  const isValid = validateBtcAddressFrontend(specialAddress);
  console.log(`Тест #${i+1}: ${specialAddress} - ${isValid ? '✅ Проходит' : '❌ Не проходит'}`);
}

console.log("\n✅ Тестирование завершено!");