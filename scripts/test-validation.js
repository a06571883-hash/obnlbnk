// Простой тест для проверки, как работает библиотека
import validator from 'bitcoin-address-validation';

// Выведем информацию о самой библиотеке
console.log('Библиотека:', validator);
console.log('Тип библиотеки:', typeof validator);

// Простой тест с известным действительным адресом Bitcoin
const address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'; // первый BTC адрес Сатоши Накамото
console.log(`\nТестовый адрес: ${address}`);

// Попробуем вызвать функцию напрямую
try {
  const result = validator(address);
  console.log('Результат:', result);
} catch (error) {
  console.error('Ошибка при вызове validator:', error);
}

// Протестируем с явным вызовом метода validate, если он есть
if (validator.validate) {
  try {
    const result = validator.validate(address);
    console.log('Результат validator.validate:', result);
  } catch (error) {
    console.error('Ошибка при вызове validator.validate:', error);
  }
}

// Попробуем другой подход
try {
  const { isValid, type, network } = validator(address);
  console.log('Деструктурированный результат:', { isValid, type, network });
} catch (error) {
  console.error('Ошибка при деструктуризации:', error);
}