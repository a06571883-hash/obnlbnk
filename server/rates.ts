import { storage } from "./storage";

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
const UPDATE_INTERVAL = 30000; // Increased to 30 seconds
const RETRY_DELAY = 60000; // 1 minute delay after error
let lastSuccessfulRates: { 
  usdToUah: string; 
  btcToUsd: string; 
  ethToUsd: string; 
  timestamp: number;
} | null = null;

async function fetchRates() {
  try {
    // If we have recent rates (less than 5 minutes old), use them
    if (lastSuccessfulRates && Date.now() - lastSuccessfulRates.timestamp < 300000) {
      await storage.updateExchangeRates(lastSuccessfulRates);
      return;
    }

    console.log("Fetching rates from CoinGecko...");
    const cryptoResponse = await fetch(
      `${COINGECKO_API_URL}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`
    );

    if (!cryptoResponse.ok) {
      throw new Error(`CoinGecko API error: ${cryptoResponse.status}`);
    }

    const cryptoData = await cryptoResponse.json();

    if (!cryptoData?.bitcoin?.usd || !cryptoData?.ethereum?.usd) {
      throw new Error("Invalid response from CoinGecko API");
    }

    const usdResponse = await fetch(
      "https://open.er-api.com/v6/latest/USD"
    );

    if (!usdResponse.ok) {
      throw new Error(`Exchange Rate API error: ${usdResponse.status}`);
    }

    const usdData = await usdResponse.json();

    if (!usdData?.rates?.UAH) {
      throw new Error("Invalid response from Exchange Rate API");
    }

    const rates = {
      usdToUah: usdData.rates.UAH.toString(),
      btcToUsd: cryptoData.bitcoin.usd.toString(),
      ethToUsd: cryptoData.ethereum.usd.toString(),
      timestamp: Date.now()
    };

    await storage.updateExchangeRates(rates);
    lastSuccessfulRates = rates;

    console.log("Exchange rates updated successfully:", {
      usdToUah: usdData.rates.UAH,
      btcToUsd: cryptoData.bitcoin.usd,
      ethToUsd: cryptoData.ethereum.usd
    });
  } catch (error) {
    console.error("Error updating exchange rates:", error);

    // If we have last successful rates, use them as fallback
    if (lastSuccessfulRates) {
      console.log("Using cached rates due to API error");
      await storage.updateExchangeRates(lastSuccessfulRates);
    }

    // Wait longer before retrying after an error
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }
}

export function startRateUpdates() {
  console.log("Starting rate updates service...");
  // Initial update
  fetchRates();

  // Set up periodic updates with increased interval
  setInterval(fetchRates, UPDATE_INTERVAL);
}