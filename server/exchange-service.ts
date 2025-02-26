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

export async function getExchangeRate(fromCurrency: string, toCurrency: string, amount: string): Promise<ExchangeRate> {
  try {
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
    const cleanCardNumber = params.bankDetails?.cardNumber?.replace(/\s+/g, '') || '';

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

    const requestBody = {
      from: params.fromCurrency.toLowerCase(),
      to: 'uah',
      amount: params.fromAmount,
      address: cleanCardNumber,
      extraId: null,
      userId: "javascript-exchange-" + Date.now(),
      payload: {
        description: "Crypto to UAH exchange",
        merchantId: "bank-transfer",
        payoutMethod: "bank_card",
        bankDetails: {
          cardNumber: cleanCardNumber,
          bankName: "Ukrainian Bank",
          country: "UA"
        }
      }
    };

    console.log('Sending request to API:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY!
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error('Create exchange error:', error);
      throw new Error(error.message || 'Failed to create exchange transaction');
    }

    const result = await response.json();
    console.log('Exchange API response:', JSON.stringify(result, null, 2));

    return {
      ...result,
      status: 'new',
      expectedAmount: result.amount,
      payinAddress: result.payinAddress,
      payoutAddress: cleanCardNumber
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