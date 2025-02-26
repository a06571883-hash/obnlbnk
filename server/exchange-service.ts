import fetch from 'node-fetch';

const API_KEY = process.env.CHANGENOW_API_KEY;
const API_URL = 'https://api.changenow.io/v1';

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
    // Use local rate calculation instead of API for better reliability
    const rates = await fetch('http://localhost:5000/api/rates').then(res => res.json());

    let estimatedAmount = '0';
    let rate = '0';

    if (fromCurrency === 'btc' && toCurrency === 'uah') {
      rate = (parseFloat(rates.btcToUsd) * parseFloat(rates.usdToUah)).toString();
      estimatedAmount = (parseFloat(amount) * parseFloat(rate)).toString();
    } else if (fromCurrency === 'eth' && toCurrency === 'uah') {
      rate = (parseFloat(rates.ethToUsd) * parseFloat(rates.usdToUah)).toString();
      estimatedAmount = (parseFloat(amount) * parseFloat(rate)).toString();
    }

    return {
      estimatedAmount,
      rate,
      transactionSpeedForecast: "15-30 minutes"
    };
  } catch (error) {
    console.error('Exchange rate error:', error);
    throw error;
  }
}

export async function createExchangeTransaction(params: CreateTransaction) {
  try {
    if (!validateUkrainianCard(params.bankDetails?.cardNumber || '')) {
      throw new Error('Invalid Ukrainian bank card number');
    }

    // Check minimum amounts
    const minAmounts = {
      btc: 0.001,
      eth: 0.01
    };

    const amount = parseFloat(params.fromAmount);
    const minAmount = minAmounts[params.fromCurrency.toLowerCase() as keyof typeof minAmounts];

    if (isNaN(amount) || amount < minAmount) {
      throw new Error(`Minimum amount for ${params.fromCurrency.toUpperCase()} is ${minAmount}`);
    }

    const response = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY!
      },
      body: JSON.stringify({
        from: params.fromCurrency.toLowerCase(),
        to: 'uah',
        amount: params.fromAmount,
        address: params.bankDetails?.cardNumber, // Use bank card number as payout address
        extraId: null,
        userId: "javascript-exchange-" + Date.now(), // Unique identifier for the transaction
        payload: {
          description: "Crypto to UAH exchange",
          merchantId: "bank-transfer",
          payoutMethod: "bank_card",
          bankDetails: {
            cardNumber: params.bankDetails?.cardNumber,
            country: "UA",
            bankName: "Ukrainian Bank"
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error('Create exchange error:', error);
      throw new Error(error.message || 'Failed to create exchange transaction');
    }

    const result = await response.json();
    return {
      ...result,
      status: 'new',
      expectedAmount: result.amount,
      payinAddress: result.payinAddress,
      payoutAddress: params.bankDetails?.cardNumber
    };
  } catch (error) {
    console.error('Create exchange error:', error);
    throw error;
  }
}

export async function getTransactionStatus(id: string) {
  try {
    const response = await fetch(`${API_URL}/transactions/${id}`, {
      headers: {
        'x-api-key': API_KEY!
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to get transaction status');
    }

    return response.json();
  } catch (error) {
    console.error('Transaction status error:', error);
    throw error;
  }
}