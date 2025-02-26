import fetch from 'node-fetch';

const API_KEY = process.env.CHANGENOW_API_KEY;
const API_URL = 'https://api.changenow.io/v2';

interface ExchangeRate {
  estimatedAmount: string;
  transactionSpeedForecast: string;
  rate: string;
}

interface CreateTransaction {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  address: string;
  extraId?: string;
}

export async function getExchangeRate(fromCurrency: string, toCurrency: string, amount: string): Promise<ExchangeRate> {
  const response = await fetch(
    `${API_URL}/exchange/estimated-amount?` + 
    `fromCurrency=${fromCurrency}&` +
    `toCurrency=${toCurrency}&` +
    `fromAmount=${amount}&` +
    `api_key=${API_KEY}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get exchange rate');
  }

  return response.json();
}

export async function createExchangeTransaction(params: CreateTransaction) {
  const response = await fetch(`${API_URL}/exchange/fix-rate/transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!
    },
    body: JSON.stringify({
      from: params.fromCurrency,
      to: params.toCurrency,
      amount: params.fromAmount,
      address: params.address,
      extraId: params.extraId,
      refundAddress: params.address
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create exchange transaction');
  }

  return response.json();
}

export async function getTransactionStatus(id: string) {
  const response = await fetch(`${API_URL}/exchange/by-id?id=${id}&api_key=${API_KEY}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get transaction status');
  }

  return response.json();
}
