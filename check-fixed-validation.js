// Старая реализация
function validateBtcAddressOld(address) {
  const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
  return legacyRegex.test(address) || bech32Regex.test(address);
}

// Новая реализация
function validateBtcAddressNew(address) {
  // Обновленная регулярка для Legacy и P2SH адресов
  const legacyRegex = /^[13][a-km-zA-HJ-NP-Z0-9]{24,33}$/;
  // Регулярка для SegWit адресов (bc1...)
  const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
  
  // Проверяем дополнительно, чтобы отсечь явно некорректные адреса
  const hasInvalidPattern = address.includes('BTC') || address.includes('btc');
  
  return (legacyRegex.test(address) || bech32Regex.test(address)) && !hasInvalidPattern;
}

// Проблемный адрес
const problemAddress = '11QAZXSWedcvfr4322WSXZxsw';

console.log('===== Проверка проблемного адреса =====');
console.log(`Адрес: ${problemAddress}`);
console.log(`Длина адреса: ${problemAddress.length} символов`);
console.log(`Старая валидация: ${validateBtcAddressOld(problemAddress) ? 'валиден ✅' : 'невалиден ❌'}`);
console.log(`Новая валидация: ${validateBtcAddressNew(problemAddress) ? 'валиден ✅' : 'невалиден ❌'}`);

// Проверим дополнительные адреса
const testAddresses = [
  '11QAZXSWedcvfr4322WSXZxsw', // проблемный адрес из скриншота
  '1hMe3U2Vnbk4frpqQwN3hgF9uwEoE1', // существующий адрес
  '1M2CiY8ibFcmK6u5eQXy5WH75daH5p', // существующий адрес
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // первый BTC адрес Сатоши
  '19JF5H5tyfsQ1f2ZYZs7mn8fqbuDsM', // существующий адрес
  '1BTCadressFAKE12345', // адрес с недопустимым паттерном
  '1000000000000000000', // недопустимый адрес с повторяющимися цифрами
  '1abcd4567890abcdefghijklmnopqrst' // слишком длинный адрес
];

console.log('\n===== Проверка тестовых адресов =====');
testAddresses.forEach(address => {
  const oldResult = validateBtcAddressOld(address);
  const newResult = validateBtcAddressNew(address);
  console.log(`${address} - Старая: ${oldResult ? '✅' : '❌'}, Новая: ${newResult ? '✅' : '❌'}`);
});
