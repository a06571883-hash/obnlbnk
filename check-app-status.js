/**
 * Скрипт для проверки статуса приложения
 */
import http from 'node:http';

// Функция для проверки, работает ли сервер на заданном порту
function checkServerPort(port) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: 'localhost',
      port: port,
      path: '/',
      timeout: 3000
    }, (res) => {
      console.log(`Server on port ${port} is running, status: ${res.statusCode}`);
      resolve(true);
    });

    req.on('error', (err) => {
      console.log(`Server on port ${port} is not running: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`Request to port ${port} timed out`);
      req.destroy();
      resolve(false);
    });
  });
}

// Проверяем все возможные порты
async function checkAllPorts() {
  console.log('Checking server status...');
  
  // Проверяем порт 5000 (оригинальный)
  const port5000 = await checkServerPort(5000);
  
  // Проверяем порт 5001 (альтернативный)
  const port5001 = await checkServerPort(5001);
  
  // Проверяем порт 8080 (NFT сервер)
  const port8080 = await checkServerPort(8080);
  
  console.log('\nServer Status Summary:');
  console.log(`Main Server (port 5000): ${port5000 ? 'RUNNING' : 'NOT RUNNING'}`);
  console.log(`Alternative Server (port 5001): ${port5001 ? 'RUNNING' : 'NOT RUNNING'}`);
  console.log(`NFT Image Server (port 8080): ${port8080 ? 'RUNNING' : 'NOT RUNNING'}`);
  
  if (!port5000 && !port5001) {
    console.log('\n❌ PROBLEM: Main application server is not running on any port!');
  } else {
    console.log('\n✅ Main application is running');
  }
  
  if (!port8080) {
    console.log('\n❌ PROBLEM: NFT Image server is not running!');
  } else {
    console.log('\n✅ NFT Image server is running');
  }
}

// Запускаем проверку
checkAllPorts();