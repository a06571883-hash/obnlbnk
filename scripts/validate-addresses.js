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
  const result = validate(address);
  console.log(`Адрес: ${address}`);
  console.log(`Валидный: ${result.isValid}`);
  console.log(`Тип: ${result.type}`);
  console.log(`Сеть: ${result.network}`);
  console.log('-'.repeat(40));
});

// Проверим наши бессмысловые последовательности с префиксом 1
const invalidAddresses = [
  '1vJUCxFNBL7fiMiuCYtomDd4M7', // наш сгенерированный адрес из предыдущего теста
  '1C7ZvT5tas9NJYez9t7R8nYkuLBK49CJg', // наш первый адрес
  '1CryptoAddressForUser123456789abcdef' // резервный вариант
];

console.log("\nПроверка наших адресов:\n");
invalidAddresses.forEach(address => {
  const result = validate(address);
  console.log(`Адрес: ${address}`);
  console.log(`Валидный: ${result.isValid}`);
  if (result.isValid) {
    console.log(`Тип: ${result.type}`);
    console.log(`Сеть: ${result.network}`);
  } else {
    console.log('Причина: Вероятно, не соответствует формату Base58Check или отсутствует правильная контрольная сумма');
  }
  console.log('-'.repeat(40));
});