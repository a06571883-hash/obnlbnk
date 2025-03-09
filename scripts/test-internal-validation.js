// Скрипт для проверки нашей внутренней функции валидации
import { validateCryptoAddress } from '../server/utils/crypto.ts';

// Адреса для проверки
const btcAddresses = [
  '1cYswh1CRg89TWzDyvRMAdnyGBCwM', // наш старый сгенерированный адрес
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // первый BTC адрес Сатоши
  '1CounterpartyXXXXXXXXXXXXXXXUWLpVr', // Адрес Counterparty
  '1BitcoinEaterAddressDontSendf59kuE', // Bitcoin eater address
  '3MbYQMMmSkC3AgWkj9FMo5LsPTW1zBTwXL', // P2SH адрес
  'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', // SegWit адрес
  'invalid_address' // Невалидный адрес
];

const ethAddresses = [
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // валидный ETH адрес
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44', // невалидный ETH адрес (короче)
  '0x742d35cc6634c0532925a3b844bc454e4438f44e', // ETH адрес в нижнем регистре
  'invalid_eth_address' // Невалидный ETH адрес
];

console.log("ТЕСТИРОВАНИЕ BITCOIN АДРЕСОВ:");
console.log('-'.repeat(60));
btcAddresses.forEach(address => {
  const isValid = validateCryptoAddress(address, 'btc');
  console.log(`Адрес: ${address}`);
  console.log(`Внутренняя валидация: ${isValid ? 'ВАЛИДНЫЙ ✅' : 'НЕВАЛИДНЫЙ ❌'}`);
  console.log('-'.repeat(40));
});

console.log("\nТЕСТИРОВАНИЕ ETHEREUM АДРЕСОВ:");
console.log('-'.repeat(60));
ethAddresses.forEach(address => {
  const isValid = validateCryptoAddress(address, 'eth');
  console.log(`Адрес: ${address}`);
  console.log(`Внутренняя валидация: ${isValid ? 'ВАЛИДНЫЙ ✅' : 'НЕВАЛИДНЫЙ ❌'}`);
  console.log('-'.repeat(40));
});