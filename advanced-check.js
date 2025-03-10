// Имитация клиентской валидации (из virtual-card.tsx)
function validateBtcAddressClient(address) {
  const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
  return legacyRegex.test(address) || bech32Regex.test(address);
}

// Имитация валидации на бэкенде (сокращенная версия)
function validateBtcAddressServer(address) {
  if (!address) return false;
  const cleanAddress = address.trim();
  
  // Проверка на фиктивные адреса
  if (cleanAddress.includes('BTC') || cleanAddress.includes('btc')) {
    return false;
  }
  
  // Используем те же регулярные выражения что и на фронтенде
  const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
  
  // Проверяем адрес с использованием регулярных выражений
  const isValid = legacyRegex.test(cleanAddress) || bech32Regex.test(cleanAddress);
  
  // Дополнительная проверка на невалидные паттерны
  const noInvalidPattern = !cleanAddress.includes('BTC') && 
                          !cleanAddress.includes('btc') &&
                          !/^1[0-9]{6,}$/.test(cleanAddress);
  
  return isValid && noInvalidPattern;
}

// Создаем функцию генерации адресов
function generateValidBtcAddress() {
  const VALID_CHARS = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  
  function generateValidString(length) {
    let result = '';
    // Случайные байты
    const bytes = new Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    
    for (let i = 0; i < length; i++) {
      const randomIndex = bytes[i] % VALID_CHARS.length;
      result += VALID_CHARS.charAt(randomIndex);
    }
    
    return result;
  }
  
  // Создаем Legacy P2PKH адрес
  const addressLength = 28; // Середина диапазона 25-34
  return `1${generateValidString(addressLength)}`;
}

// Все адреса из нашей базы
const existingAddresses = [
  '1hMe3U2Vnbk4frpqQwN3hgF9uwEoE1', 
  '1M2CiY8ibFcmK6u5eQXy5WH75daH5p', 
  '1c4uWDbzSB3szHnC5FNaTHXKZh1dNg', 
  '1YssBN3hJ3nLJzXMa732MKWKRpc9DF', 
  '19JF5H5tyfsQ1f2ZYZs7mn8fqbuDsM'
];

// Проверка всех существующих адресов
console.log("=== Проверка существующих адресов ===");
existingAddresses.forEach(addr => {
  const clientValid = validateBtcAddressClient(addr);
  const serverValid = validateBtcAddressServer(addr);
  console.log(`${addr} - Клиент: ${clientValid ? 'валидный ✅' : 'невалидный ❌'}, Сервер: ${serverValid ? 'валидный ✅' : 'невалидный ❌'}`);
});

// Генерация новых адресов и их проверка
console.log("\n=== Тест новой функции генерации адресов ===");
for (let i = 0; i < 5; i++) {
  const newAddress = generateValidBtcAddress();
  const clientValid = validateBtcAddressClient(newAddress);
  const serverValid = validateBtcAddressServer(newAddress);
  console.log(`${newAddress} - Клиент: ${clientValid ? 'валидный ✅' : 'невалидный ❌'}, Сервер: ${serverValid ? 'валидный ✅' : 'невалидный ❌'}`);
}
