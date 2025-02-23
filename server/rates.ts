import { storage } from "./storage";

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
const UPDATE_INTERVAL = 2000; // 2 seconds

async function fetchRates() {
  try {
    // Fetch crypto rates from CoinGecko
    console.log("Fetching rates from CoinGecko...");
    const cryptoResponse = await fetch(
      `${COINGECKO_API_URL}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`
    );

    if (!cryptoResponse.ok) {
      throw new Error(`CoinGecko API error: ${cryptoResponse.status}`);
    }

    const cryptoData = await cryptoResponse.json();

    // Validate crypto data
    if (!cryptoData?.bitcoin?.usd || !cryptoData?.ethereum?.usd) {
      throw new Error("Invalid response from CoinGecko API");
    }

    // Fetch USD to UAH rate from ExchangeRate-API (free, no key needed)
    const usdResponse = await fetch(
      "https://open.er-api.com/v6/latest/USD"
    );

    if (!usdResponse.ok) {
      throw new Error(`Exchange Rate API error: ${usdResponse.status}`);
    }

    const usdData = await usdResponse.json();

    // Validate USD data
    if (!usdData?.rates?.UAH) {
      throw new Error("Invalid response from Exchange Rate API");
    }

    // Update rates in database
    await storage.updateExchangeRates({
      usdToUah: usdData.rates.UAH.toString(),
      btcToUsd: cryptoData.bitcoin.usd.toString(),
      ethToUsd: cryptoData.ethereum.usd.toString(),
    });

    console.log("Exchange rates updated successfully:", {
      usdToUah: usdData.rates.UAH,
      btcToUsd: cryptoData.bitcoin.usd,
      ethToUsd: cryptoData.ethereum.usd
    });
  } catch (error) {
    console.error("Error updating exchange rates:", error);
    // Wait before retrying to avoid API rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

export function startRateUpdates() {
  console.log("Starting rate updates service...");
  // Initial update
  fetchRates();

  // Set up periodic updates
  setInterval(fetchRates, UPDATE_INTERVAL);
}