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
  availableBalance?: string;
}

function validateUkrainianCard(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');
  console.log('Clean card number:', cleanNumber);
  return cleanNumber.length === 16 && /^\d+$/.test(cleanNumber);
}

export async function createExchangeTransaction(params: CreateTransaction) {
  try {
    console.log('Exchange params:', JSON.stringify(params, null, 2));

    // Use address as card number if bankDetails is not provided
    const cardNumber = params.bankDetails?.cardNumber || params.address;
    const cleanCardNumber = cardNumber.replace(/[\s-]/g, '');

    if (!validateUkrainianCard(cleanCardNumber)) {
      throw new Error('Пожалуйста, введите корректный 16-значный номер карты');
    }

    // Get rates and calculate exchange amount
    const rates = await fetch('http://localhost:5000/api/rates').then(res => res.json());
    let exchangeRate = 0;

    if (params.fromCurrency === 'btc') {
      exchangeRate = parseFloat(rates.btcToUsd) * parseFloat(rates.usdToUah);
    } else if (params.fromCurrency === 'eth') {
      exchangeRate = parseFloat(rates.ethToUsd) * parseFloat(rates.usdToUah);
    }

    const amount = parseFloat(params.fromAmount);
    const exchangeAmount = amount * exchangeRate;

    // Return mock transaction
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
  // Mock successful transaction
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    id,
    status: 'completed',
    updatedAt: new Date().toISOString()
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