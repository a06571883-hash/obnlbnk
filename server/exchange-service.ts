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

function validateUkrainianCard(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');
  console.log('Validating card number:', cleanNumber);
  console.log('Card number length:', cleanNumber.length);
  console.log('Is numeric:', /^\d+$/.test(cleanNumber));

  // Basic validation - must be 16 digits
  if (!/^\d{16}$/.test(cleanNumber)) {
    console.log('Card validation failed: Not 16 digits');
    return false;
  }

  const cardPrefix = cleanNumber.substring(0, 4);
  console.log('Card prefix:', cardPrefix);

  return true; // Accept any valid 16-digit number
}

export async function createExchangeTransaction(params: CreateTransaction) {
  try {
    console.log('Received transaction params:', JSON.stringify(params, null, 2));

    // Use address as card number if bankDetails is not provided
    const cardNumber = params.bankDetails?.cardNumber || params.address;
    const cleanCardNumber = cardNumber.replace(/[\s-]/g, '');
    console.log('Clean card number for validation:', cleanCardNumber);

    if (!validateUkrainianCard(cleanCardNumber)) {
      throw new Error('Please enter a valid Ukrainian bank card number');
    }

    // Get current rates and calculate exchange
    const rates = await fetch('http://localhost:5000/api/rates').then(res => res.json());

    // Get user's cards and check balances
    const cardsResponse = await fetch('http://localhost:5000/api/cards');
    if (!cardsResponse.ok) {
      throw new Error('Failed to get user cards');
    }

    const cards = await cardsResponse.json();
    const cryptoCard = cards.find((card: any) => card.type === 'crypto');

    if (!cryptoCard) {
      throw new Error('Crypto card not found');
    }

    // Check if user has enough balance
    const amount = parseFloat(params.fromAmount);
    if (params.fromCurrency === 'btc') {
      const btcBalance = parseFloat(cryptoCard.btcBalance);
      if (amount > btcBalance) {
        throw new Error(`Insufficient BTC balance. Available: ${btcBalance} BTC`);
      }
    } else if (params.fromCurrency === 'eth') {
      const ethBalance = parseFloat(cryptoCard.ethBalance);
      if (amount > ethBalance) {
        throw new Error(`Insufficient ETH balance. Available: ${ethBalance} ETH`);
      }
    }

    let exchangeRate = 0;
    if (params.fromCurrency === 'btc') {
      exchangeRate = parseFloat(rates.btcToUsd) * parseFloat(rates.usdToUah);
    } else if (params.fromCurrency === 'eth') {
      exchangeRate = parseFloat(rates.ethToUsd) * parseFloat(rates.usdToUah);
    }

    const exchangeAmount = parseFloat(params.fromAmount) * exchangeRate;

    // Return mock transaction for now
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