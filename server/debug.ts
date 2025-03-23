/**
 * Модуль для отладки и диагностики приложения
 * Содержит эндпоинты для тестирования функциональности BlockDaemon API
 */

import express from 'express';
import axios from 'axios';

const BLOCKDAEMON_API_KEY = process.env.BLOCKDAEMON_API_KEY;

/**
 * Регистрирует отладочные эндпоинты
 */
export function setupDebugRoutes(app: express.Express) {
  // Эндпоинт для проверки статуса BlockDaemon API
  app.get('/api/debug/blockchain-status', async (req, res) => {
    try {
      console.log('🔍 Проверка доступности BlockDaemon API и ключа');
      console.log(`🔑 API Key статус: ${BLOCKDAEMON_API_KEY ? 'Настроен (длина: ' + BLOCKDAEMON_API_KEY.length + ')' : 'НЕ НАСТРОЕН!'}`);
      
      res.json({
        api_key_status: !!BLOCKDAEMON_API_KEY,
        key_length: BLOCKDAEMON_API_KEY ? BLOCKDAEMON_API_KEY.length : 0,
        environment: process.env.NODE_ENV || 'unknown'
      });
    } catch (error) {
      console.error('Ошибка при проверке статуса BlockDaemon API:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  });

  // Тестовый эндпоинт для проверки отправки ETH транзакций
  app.get('/api/debug/test-eth-transaction', async (req, res) => {
    try {
      console.log("🧪 Запуск тестовой ETH транзакции с подробной диагностикой");
      
      // Используем тестовые адреса из параметров запроса или дефолтные
      const fromAddress = req.query.from as string || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
      const toAddress = req.query.to as string || "0x19dE91Af973F404EDF5B4c093983a7c6E3EC8ccE";
      const amount = parseFloat(req.query.amount as string || "0.001");
      
      console.log(`🔄 [TEST ETH] Отправка ${amount} ETH с ${fromAddress} на ${toAddress}`);
      console.log(`🔑 [TEST ETH] API Key статус: ${BLOCKDAEMON_API_KEY ? 'Настроен (длина: ' + BLOCKDAEMON_API_KEY.length + ')' : 'НЕ НАСТРОЕН!'}`);
      
      // Преобразуем ETH в Wei для отправки
      const valueInWei = BigInt(Math.floor(amount * 1e18)).toString();
      console.log(`💱 [TEST ETH] Конвертация: ${amount} ETH = ${valueInWei} Wei`);
      
      // Параметры для транзакции - упрощенный формат для Ethereum
      const transactionData = {
        from: fromAddress,
        to: toAddress,
        value: valueInWei,
        gas: 21000 // Стандартный газ для простой транзакции
      };
      
      console.log(`📤 [TEST ETH] Отправка транзакции через BlockDaemon API с параметрами:`);
      console.log(JSON.stringify(transactionData, null, 2));
      
      const txURL = `https://svc.blockdaemon.com/ethereum/mainnet/tx/send`;
      console.log(`🌐 [TEST ETH] URL запроса: ${txURL}`);
      
      try {
        const txResponse = await axios.post(
          txURL,
          transactionData,
          {
            headers: {
              'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 20000 // 20 секунд
          }
        );
        
        console.log(`📥 [TEST ETH] Получен ответ от API. Статус: ${txResponse.status}`);
        console.log(`📊 [TEST ETH] Данные ответа:`, txResponse.data);
        
        const txId = txResponse.data?.transaction_hash || txResponse.data?.txid || txResponse.data?.txhash || txResponse.data?.tx_hash;
        
        if (txId) {
          console.log(`✅ [TEST ETH] Транзакция успешно отправлена. TxID: ${txId}`);
          res.json({ 
            success: true, 
            message: 'Тестовая ETH транзакция успешно отправлена', 
            txId,
            response: txResponse.data 
          });
        } else {
          console.error(`❌ [TEST ETH] Не удалось получить TxID из ответа API:`);
          console.error(JSON.stringify(txResponse.data));
          res.status(500).json({ 
            success: false, 
            message: 'Не удалось получить идентификатор транзакции', 
            error: 'Нет идентификатора транзакции в ответе API',
            response: txResponse.data
          });
        }
      } catch (error: any) {
        console.error(`❌ [TEST ETH] Ошибка при отправке ETH транзакции через API:`);
        console.error(`   - Сообщение:`, error.message || 'Неизвестная ошибка');
        console.error(`   - Статус:`, error.response?.status || 'Неизвестно');
        console.error(`   - Данные:`, error.response?.data || {});
        
        res.status(500).json({ 
          success: false, 
          message: 'Ошибка при отправке тестовой ETH транзакции', 
          error: error.message,
          errorDetails: {
            status: error.response?.status,
            data: error.response?.data
          }
        });
      }
    } catch (error: any) {
      console.error(`❌ [TEST ETH] Критическая ошибка:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Критическая ошибка при тестировании ETH транзакции', 
        error: error.message 
      });
    }
  });

  // Эндпоинт для проверки поддерживаемых сетей в BlockDaemon API
  app.get('/api/debug/blockdaemon-networks', async (req, res) => {
    try {
      if (!BLOCKDAEMON_API_KEY) {
        return res.status(400).json({ 
          success: false, 
          message: 'BlockDaemon API ключ не настроен' 
        });
      }
      
      const networksURL = 'https://svc.blockdaemon.com/universal/v1/networks';
      console.log(`🌐 Запрос поддерживаемых сетей: ${networksURL}`);
      
      const response = await axios.get(networksURL, {
        headers: {
          'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      res.json({
        success: true,
        networks: response.data
      });
    } catch (error: any) {
      console.error('Ошибка при запросе поддерживаемых сетей:', error.message);
      res.status(500).json({
        success: false,
        message: 'Ошибка при запросе поддерживаемых сетей',
        error: error.message,
        details: error.response?.data
      });
    }
  });
  
  // Эндпоинт для проверки эндпоинтов BlockDaemon API для Ethereum
  app.get('/api/debug/ethereum-endpoints', async (req, res) => {
    try {
      if (!BLOCKDAEMON_API_KEY) {
        return res.status(400).json({ 
          success: false, 
          message: 'BlockDaemon API ключ не настроен' 
        });
      }
      
      // Список URL для проверки
      const endpointsToCheck = [
        'https://svc.blockdaemon.com/ethereum/mainnet/tx/send',
        'https://svc.blockdaemon.com/ethereum/mainnet/account',
        'https://svc.blockdaemon.com/universal/v1/ethereum/mainnet/tx',
        'https://svc.blockdaemon.com/universal/v1/ethereum/mainnet/account'
      ];
      
      console.log(`🌐 Проверка доступных эндпоинтов Ethereum для вашего API ключа`);
      
      // Проверяем каждый эндпоинт используя HTTP OPTIONS
      const results = await Promise.all(
        endpointsToCheck.map(async url => {
          try {
            const response = await axios({
              method: 'options',
              url,
              headers: {
                'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
                'Accept': 'application/json'
              }
            });
            
            return {
              url,
              status: response.status,
              available: true,
              methods: response.headers['allow'] || 'Unknown'
            };
          } catch (error: any) {
            return {
              url,
              status: error.response?.status || 0,
              available: false,
              error: error.message,
              details: error.response?.data
            };
          }
        })
      );
      
      res.json({
        success: true,
        endpoints: results
      });
    } catch (error: any) {
      console.error('Ошибка при проверке Ethereum эндпоинтов:', error.message);
      res.status(500).json({
        success: false,
        message: 'Ошибка при проверке Ethereum эндпоинтов',
        error: error.message
      });
    }
  });
  
  // Эндпоинт для проверки статуса и доступных протоколов Ethereum
  app.get('/api/debug/ethereum-protocols', async (req, res) => {
    try {
      if (!BLOCKDAEMON_API_KEY) {
        return res.status(400).json({ 
          success: false, 
          message: 'BlockDaemon API ключ не настроен' 
        });
      }
      
      const protocolsURL = 'https://svc.blockdaemon.com/ethereum/mainnet/protocols';
      console.log(`🌐 Запрос протоколов Ethereum: ${protocolsURL}`);
      
      const response = await axios.get(protocolsURL, {
        headers: {
          'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      res.json({
        success: true,
        protocols: response.data
      });
    } catch (error: any) {
      console.error('Ошибка при запросе протоколов Ethereum:', error.message);
      res.status(500).json({
        success: false,
        message: 'Ошибка при запросе протоколов Ethereum',
        error: error.message,
        details: error.response?.data
      });
    }
  });
  
  // Эндпоинт для проверки поддерживаемых методов для отправки ETH транзакций
  app.get('/api/debug/ethereum-send-methods', async (req, res) => {
    try {
      if (!BLOCKDAEMON_API_KEY) {
        return res.status(400).json({ 
          success: false, 
          message: 'BlockDaemon API ключ не настроен' 
        });
      }
      
      const endpointURL = 'https://svc.blockdaemon.com/ethereum/mainnet/tx/send';
      console.log(`🌐 Проверка методов для URL: ${endpointURL}`);
      
      try {
        // Сначала пробуем HEAD запрос чтобы не тратить ресурсы
        const headResponse = await axios({
          method: 'head',
          url: endpointURL,
          headers: {
            'Authorization': `Bearer ${BLOCKDAEMON_API_KEY}`,
            'Accept': 'application/json'
          }
        });
        
        res.json({
          success: true,
          url: endpointURL,
          available: true,
          status: headResponse.status,
          headers: headResponse.headers
        });
      } catch (headError: any) {
        // Если HEAD не поддерживается, смотрим на ошибку
        console.log(`⚠️ HEAD запрос не прошел: ${headError.message}`);
        
        res.json({
          success: false,
          url: endpointURL,
          available: false,
          error: headError.message,
          status: headError.response?.status,
          data: headError.response?.data
        });
      }
    } catch (error: any) {
      console.error('Ошибка при проверке методов отправки ETH:', error.message);
      res.status(500).json({
        success: false,
        message: 'Ошибка при проверке методов отправки ETH',
        error: error.message
      });
    }
  });
  
  console.log('✅ Отладочные эндпоинты настроены');
}