import { storage } from "./storage";
import { WebSocket, WebSocketServer } from 'ws';
import { parse } from 'url';
import { IncomingMessage } from 'http';
import type { Server } from 'http';

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
const UPDATE_INTERVAL = 30000; // 30 секунд
const RETRY_DELAY = 60000; // 1 минута после ошибки
let wss: WebSocketServer;
let lastSuccessfulRates: { 
  usdToUah: string; 
  btcToUsd: string; 
  ethToUsd: string; 
  timestamp: number;
} | null = null;

// Функция для отправки обновлений курсов всем подключенным клиентам
function broadcastRates(rates: typeof lastSuccessfulRates) {
  if (!wss) return;

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(rates));
    }
  });
}

interface VerifyClientInfo {
  origin: string;
  secure: boolean;
  req: IncomingMessage;
}

export function startRateUpdates(server: Server, path: string = '/ws') {
  console.log("Запуск сервиса обновления курсов...");

  // Инициализация WebSocket сервера с проверкой пути
  wss = new WebSocketServer({ 
    server,
    verifyClient: (info: VerifyClientInfo) => {
      const { pathname } = parse(info.req.url || '');
      return pathname === path;
    }
  });

  wss.on('connection', (ws) => {
    console.log('Новое WebSocket подключение');

    // Отправляем текущие курсы при подключении
    if (lastSuccessfulRates) {
      ws.send(JSON.stringify(lastSuccessfulRates));
    }

    ws.on('error', (error) => {
      console.error('WebSocket ошибка:', error);
    });
  });

  // Начальное обновление
  fetchRates();

  // Настройка периодических обновлений
  setInterval(fetchRates, UPDATE_INTERVAL);
}

async function fetchRates() {
  try {
    if (lastSuccessfulRates && Date.now() - lastSuccessfulRates.timestamp < 300000) {
      await storage.updateExchangeRates({
        usdToUah: parseFloat(lastSuccessfulRates.usdToUah),
        btcToUsd: parseFloat(lastSuccessfulRates.btcToUsd),
        ethToUsd: parseFloat(lastSuccessfulRates.ethToUsd)
      });
      broadcastRates(lastSuccessfulRates);
      return;
    }

    console.log("Получаем курсы с CoinGecko...");
    const cryptoResponse = await fetch(
      `${COINGECKO_API_URL}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`
    );

    if (!cryptoResponse.ok) {
      throw new Error(`Ошибка API CoinGecko: ${cryptoResponse.status}`);
    }

    const cryptoData = await cryptoResponse.json();

    if (!cryptoData?.bitcoin?.usd || !cryptoData?.ethereum?.usd) {
      throw new Error("Неверный ответ от API CoinGecko");
    }

    const usdResponse = await fetch(
      "https://open.er-api.com/v6/latest/USD"
    );

    if (!usdResponse.ok) {
      throw new Error(`Ошибка API курсов валют: ${usdResponse.status}`);
    }

    const usdData = await usdResponse.json();

    if (!usdData?.rates?.UAH) {
      throw new Error("Неверный ответ от API курсов валют");
    }

    const rates = {
      usdToUah: usdData.rates.UAH.toString(),
      btcToUsd: cryptoData.bitcoin.usd.toString(),
      ethToUsd: cryptoData.ethereum.usd.toString(),
      timestamp: Date.now()
    };

    await storage.updateExchangeRates({
      usdToUah: parseFloat(rates.usdToUah),
      btcToUsd: parseFloat(rates.btcToUsd),
      ethToUsd: parseFloat(rates.ethToUsd)
    });

    lastSuccessfulRates = rates;
    broadcastRates(rates);

    console.log("Курсы валют успешно обновлены:", {
      usdToUah: usdData.rates.UAH,
      btcToUsd: cryptoData.bitcoin.usd,
      ethToUsd: cryptoData.ethereum.usd
    });
    
    console.log(`Текущие курсы для конвертации:
      1 USD = ${usdData.rates.UAH} UAH
      1 BTC = ${cryptoData.bitcoin.usd} USD = ${cryptoData.bitcoin.usd * usdData.rates.UAH} UAH
      1 ETH = ${cryptoData.ethereum.usd} USD = ${cryptoData.ethereum.usd * usdData.rates.UAH} UAH`);
  } catch (error) {
    console.error("Ошибка обновления курсов:", error);

    if (lastSuccessfulRates) {
      console.log("Используем кэшированные курсы из-за ошибки API");
      await storage.updateExchangeRates({
        usdToUah: parseFloat(lastSuccessfulRates.usdToUah),
        btcToUsd: parseFloat(lastSuccessfulRates.btcToUsd),
        ethToUsd: parseFloat(lastSuccessfulRates.ethToUsd)
      });
      broadcastRates(lastSuccessfulRates);
    }

    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }
}