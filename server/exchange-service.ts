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
  bankDetails?: {
    cardNumber: string;
    bankName?: string;
  };
}

// Validates Ukrainian bank card number (16 digits, starts with specific prefixes)
export function validateUkrainianCard(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/\s+/g, '');
  const ukrPrefixes = ['4149', '5168', '5167', '4506', '4508', '4558'];
  return cleanNumber.length === 16 && ukrPrefixes.some(prefix => cleanNumber.startsWith(prefix));
}

export async function getExchangeRate(fromCurrency: string, toCurrency: string, amount: string): Promise<ExchangeRate> {
  try {
    // Changed to GET request with query parameters
    const url = new URL(`${API_URL}/exchange/estimated-amount`);
    url.searchParams.append('fromCurrency', fromCurrency.toLowerCase());
    url.searchParams.append('toCurrency', toCurrency.toLowerCase());
    url.searchParams.append('fromAmount', amount);

    const response = await fetch(url.toString(), {
      method: 'GET', // Changed to GET
      headers: {
        'x-api-key': API_KEY!
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error('Exchange rate API error:', error);
      throw new Error(error.message || 'Failed to get exchange rate');
    }

    const data = await response.json();
    return {
      estimatedAmount: data.estimatedAmount.toString(),
      rate: data.rate.toString(),
      transactionSpeedForecast: data.transactionSpeedForecast || 'within 30 minutes'
    };
  } catch (error) {
    console.error('Exchange rate error:', error);
    throw error;
  }
}

export async function createExchangeTransaction(params: CreateTransaction) {
  try {
    const response = await fetch(`${API_URL}/exchange/standard-flow/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY!
      },
      body: JSON.stringify({
        fromCurrency: params.fromCurrency.toLowerCase(),
        toCurrency: params.toCurrency.toLowerCase(),
        fromAmount: params.fromAmount,
        toAmount: '1', // Required for standard flow
        fromNetwork: 'default',
        toNetwork: 'default',
        payoutAddress: params.address,
        payoutExtraId: params.extraId,
        refundAddress: params.address, // Using the same address for refund
        refundExtraId: params.extraId,
        bankCard: params.bankDetails?.cardNumber
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create exchange transaction');
    }

    return response.json();
  } catch (error) {
    console.error('Create exchange error:', error);
    throw error;
  }
}

export async function getTransactionStatus(id: string) {
  try {
    const response = await fetch(`${API_URL}/exchange/by-id/${id}`, {
      headers: {
        'x-api-key': API_KEY!
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get transaction status');
    }

    return response.json();
  } catch (error) {
    console.error('Transaction status error:', error);
    throw error;
  }
}