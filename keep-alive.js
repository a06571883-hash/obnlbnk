
/**
 * Бесплатный Keep-alive сервис для Replit
 * Поддерживает сервер активным 24/7 без оплаты
 */

const http = require('http');

// Конфигурация для бесплатного мониторинга
const KEEP_ALIVE_CONFIG = {
  // Интервал внутренних пингов (3 минуты)
  internalInterval: 3 * 60 * 1000,
  
  // Порт для мониторинга
  port: process.env.PORT || 5000,
  
  // URL для внешнего мониторинга
  externalUrl: process.env.REPL_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`,
  
  // Эндпоинты для проверки
  healthEndpoints: ['/api/rates', '/api/health', '/']
};

// Счетчик успешных пингов
let successCount = 0;
let errorCount = 0;

// Функция для внутреннего пинга
function internalPing() {
  const endpoint = KEEP_ALIVE_CONFIG.healthEndpoints[
    Math.floor(Math.random() * KEEP_ALIVE_CONFIG.healthEndpoints.length)
  ];
  
  const options = {
    hostname: '0.0.0.0',
    port: KEEP_ALIVE_CONFIG.port,
    path: endpoint,
    method: 'GET',
    timeout: 8000,
    headers: {
      'User-Agent': 'BNAL-Keep-Alive/1.0',
      'Cache-Control': 'no-cache'
    }
  };

  const req = http.request(options, (res) => {
    successCount++;
    console.log(`✅ Keep-alive ping #${successCount}: ${res.statusCode} - ${endpoint}`);
    
    // Читаем ответ чтобы освободить соединение
    res.on('data', () => {});
    res.on('end', () => {});
  });

  req.on('error', (err) => {
    errorCount++;
    console.log(`⚠️ Keep-alive error #${errorCount}: ${err.message}`);
  });

  req.on('timeout', () => {
    errorCount++;
    console.log(`⏰ Keep-alive timeout #${errorCount}: ${endpoint}`);
    req.destroy();
  });

  req.end();
}

// Создаем простой health check endpoint
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify({
      status: 'alive',
      uptime: process.uptime(),
      pings: { success: successCount, errors: errorCount },
      timestamp: new Date().toISOString(),
      message: 'BNAL Bank server is running'
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Keep-alive service');
  }
});

// Запускаем health check сервер на альтернативном порту
const healthPort = 3001;
server.listen(healthPort, '0.0.0.0', () => {
  console.log(`🔄 Keep-alive health check running on port ${healthPort}`);
});

// Запускаем регулярные внутренние пинги
setInterval(internalPing, KEEP_ALIVE_CONFIG.internalInterval);

// Первый пинг через 30 секунд
setTimeout(internalPing, 30000);

// Показываем инструкции по настройке внешнего мониторинга
console.log('\n🆓 БЕСПЛАТНАЯ НАСТРОЙКА ПОСТОЯННОЙ РАБОТЫ:');
console.log('1. Зарегистрируйтесь на https://uptimerobot.com (бесплатно)');
console.log('2. Добавьте HTTP мониторинг для URL:');
console.log(`   ${KEEP_ALIVE_CONFIG.externalUrl}/health`);
console.log('3. Установите интервал проверки: 5 минут');
console.log('4. Ваш сервер будет работать 24/7 БЕСПЛАТНО!');
console.log('\n🔄 Keep-alive сервис запущен и готов к работе');

module.exports = { internalPing, successCount, errorCount };
