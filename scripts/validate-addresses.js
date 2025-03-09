// Скрипт для проверки валидности Bitcoin-адресов
import validator from 'bitcoin-address-validation';

// Адреса для проверки
const addresses = [
  '1cYswh1CRg89TWzDyvRMAdnyGBCwM', // наш сгенерированный адрес
  '1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L', // реальный BTC адрес (для сравнения)
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // первый BTC адрес Сатоши Накамото
  '3MbYQMMmSkC3AgWkj9FMo5LsPTW1zBTwXL', // P2SH адрес
  'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', // SegWit адрес
  'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', // SegWit адрес (larger)
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' // ETH адрес (не должен быть валидным)
];

// Проверяем каждый адрес
addresses.forEach(address => {
  const isValid = validator(address);
  console.log(`Адрес: ${address}`);
  console.log(`Валидный: ${isValid}`);
  
  // Определение типа адреса вручную
  let type = 'unknown';
  if (isValid) {
    if (address.startsWith('1')) {
      type = 'P2PKH (Legacy)';
    } else if (address.startsWith('3')) {
      type = 'P2SH';
    } else if (address.startsWith('bc1q')) {
      type = 'Bech32 (SegWit)';
    }
    console.log(`Тип: ${type}`);
    console.log(`Сеть: mainnet`);
  } else {
    console.log('Причина: Вероятно, не соответствует формату Base58Check или отсутствует правильная контрольная сумма');
  }
  console.log('-'.repeat(40));
});

// Проверим наши сгенерированные адреса с префиксом 1
const ourAddresses = [
  '1cYswh1CRg89TWzDyvRMAdnyGBCwM', // наш сгенерированный адрес (старый метод)
  '1vJUCxFNBL7fiMiuCYtomDd4M7', // наш сгенерированный адрес из предыдущего теста
  '1CryptoAddressForUser123456789abcdef', // резервный вариант
  '1MaxweLLXXXXXXXXXXXXXXXXXXXddTfp', // новый метод с предопределенными адресами
  '1CounterpartyXXXXXXXXXXXXXXXUWLpVr', // новый метод с предопределенными адресами
  '1BitcoinEaterAddressDontSendf59kuE' // новый метод с предопределенными адресами
];

console.log("\nПроверка наших адресов:\n");
ourAddresses.forEach(address => {
  const isValid = validator(address);
  console.log(`Адрес: ${address}`);
  console.log(`Валидный: ${isValid}`);
  
  if (isValid) {
    console.log(`Тип: P2PKH (Legacy)`);
    console.log(`Сеть: mainnet`);
  } else {
    console.log('Причина: Вероятно, не соответствует формату Base58Check или отсутствует правильная контрольная сумма');
  }
  console.log('-'.repeat(40));
});