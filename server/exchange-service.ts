import fetch from 'node-fetch';

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

    // Validate card number format (16 digits)
    if (!/^\d{16}$/.test(cleanCardNumber)) {
      throw new Error('Please enter a valid 16-digit card number');
    }

    // Get current rates
    const rates = await fetch('http://localhost:5000/api/rates').then(res => res.json());

    // Calculate exchange amount
    let exchangeRate = 0;
    if (params.fromCurrency === 'btc') {
      exchangeRate = parseFloat(rates.btcToUsd) * parseFloat(rates.usdToUah);
    } else if (params.fromCurrency === 'eth') {
      exchangeRate = parseFloat(rates.ethToUsd) * parseFloat(rates.usdToUah);
    }

    const exchangeAmount = parseFloat(params.fromAmount) * exchangeRate;

    // For now, return a mock successful transaction
    return {
      id: `mock-${Date.now()}`,
      status: 'new',
      fromCurrency: params.fromCurrency,
      toCurrency: 'uah',
      fromAmount: params.fromAmount,
      toAmount: exchangeAmount.toFixed(2),
      payoutAddress: cleanCardNumber,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Create exchange error:', error);
    throw error;
  }
}

export async function getTransactionStatus(id: string) {
  // For now, always return success after a delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    id,
    status: 'completed',
    updatedAt: new Date().toISOString()
  };
}