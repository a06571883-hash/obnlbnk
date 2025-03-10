const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const address = '11QAZXSWedcvfr4322WSXZxsw';
console.log(`${address} - ${legacyRegex.test(address) ? 'valid' : 'invalid'}`);

// Проверим длину адреса
console.log(`Длина адреса: ${address.length} символов`);

// Проверим каждый символ на соответствие регулярному выражению
for (let i = 0; i < address.length; i++) {
  const char = address[i];
  const isValid = /[13a-km-zA-HJ-NP-Z1-9]/.test(char);
  console.log(`Символ [${i}]: ${char} - ${isValid ? 'допустимый' : 'недопустимый'}`);
}
