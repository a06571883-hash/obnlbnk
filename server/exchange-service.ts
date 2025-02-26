import fetch from 'node-fetch';

const API_KEY = process.env.CHANGENOW_API_KEY;
const API_URL = 'https://api.changenow.io/v1';

interface ExchangeRate {
  estimatedAmount: string;
  rate: string;
  transactionSpeedForecast: string;
}

interface CreateTransaction {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  address: string;
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
    console.log('Processing exchange with card:', cleanCardNumber);

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

    // First get the minimum exchange amount
    const minAmountResponse = await fetch(
      `${API_URL}/min-amount/${params.fromCurrency.toLowerCase()}_uah?api_key=${API_KEY}`
    );

    if (!minAmountResponse.ok) {
      throw new Error('Failed to get minimum amount');
    }

    // Create the fixed-rate exchange
    const requestBody = {
      from: params.fromCurrency.toLowerCase(),
      to: "uah",
      amount: params.fromAmount,
      address: cleanCardNumber,
      fixedRate: true,
      refundAddress: null,
      payload: {
        description: "Crypto to UAH exchange",
        destinationType: "bank_card",
        bankDetails: {
          cardNumber: cleanCardNumber,
          bankName: "Ukrainian Bank",
          bankCountry: "UA"
        }
      }
    };

    console.log('Creating exchange with body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${API_URL}/transactions/fixed-rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY!
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error('Exchange creation error:', error);
      throw new Error(error.message || 'Failed to create exchange');
    }

    const result = await response.json();
    console.log('Exchange created:', result);

    return {
      ...result,
      status: 'new',
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
      const error = await response.json();
      throw new Error(error.message || 'Failed to get transaction status');
    }

    return response.json();
  } catch (error) {
    console.error('Transaction status error:', error);
    throw error;
  }
}