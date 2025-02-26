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
  };
  cookie?: string; // Added cookie property
}

function validateUkrainianCard(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');
  return cleanNumber.length === 16 && /^\d+$/.test(cleanNumber);
}

export async function createExchangeTransaction(params: CreateTransaction) {
  try {
    console.log('Exchange params:', JSON.stringify(params, null, 2));

    // Get user's crypto balance first
    const cardsResponse = await fetch('http://localhost:5000/api/cards', {
      headers: {
        'Cookie': params.cookie || '', // Pass session cookie from frontend
      }
    });

    if (!cardsResponse.ok) {
      console.error('Cards API error:', await cardsResponse.text());
      throw new Error('Не удалось получить информацию о балансе');
    }

    const cards = await cardsResponse.json();
    console.log('User cards:', cards);

    const cryptoCard = cards.find((card: any) => card.type === 'crypto');
    if (!cryptoCard) {
      throw new Error('Криптовалютный кошелек не найден');
    }

    // Check available balance
    const amount = parseFloat(params.fromAmount);
    const balance = params.fromCurrency === 'btc' ? 
      parseFloat(cryptoCard.btcBalance) : 
      parseFloat(cryptoCard.ethBalance);

    if (amount > balance) {
      throw new Error(`Недостаточно ${params.fromCurrency.toUpperCase()}. Доступно: ${balance}`);
    }

    // Validate card number
    const cardNumber = params.bankDetails?.cardNumber || params.address;
    const cleanCardNumber = cardNumber.replace(/[\s-]/g, '');

    if (!validateUkrainianCard(cleanCardNumber)) {
      throw new Error('Пожалуйста, введите корректный 16-значный номер карты');
    }

    // Get minimum amount from ChangeNow
    const minAmountResponse = await fetch(
      `${API_URL}/min-amount/${params.fromCurrency.toLowerCase()}_uah?api_key=${API_KEY}`
    );

    if (!minAmountResponse.ok) {
      throw new Error('Не удалось получить минимальную сумму обмена');
    }

    const minAmountData = await minAmountResponse.json();
    if (amount < parseFloat(minAmountData.minAmount)) {
      throw new Error(`Минимальная сумма для обмена: ${minAmountData.minAmount} ${params.fromCurrency.toUpperCase()}`);
    }

    // Create exchange request
    const requestBody = {
      from: params.fromCurrency.toLowerCase(),
      to: "uah",
      amount: params.fromAmount,
      address: cleanCardNumber,
      extraId: null,
      refundAddress: cryptoCard.btcAddress,
      payoutCurrency: "UAH",
      payoutMethod: "bank_card",
      bankDetails: {
        cardNumber: cleanCardNumber,
        bankName: "Ukrainian Bank",
        country: "UA"
      }
    };

    console.log('Creating exchange with body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${API_URL}/transactions/${params.fromCurrency.toLowerCase()}_uah`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY!
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Exchange API error:', errorText);
      throw new Error('Ошибка при создании обмена. Пожалуйста, попробуйте позже.');
    }

    const result = await response.json();
    console.log('Exchange created:', result);

    return {
      id: result.id,
      status: result.status,
      fromCurrency: params.fromCurrency,
      toCurrency: 'uah',
      fromAmount: params.fromAmount,
      expectedAmount: result.expectedReceiveAmount,
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

export async function getExchangeRate(fromCurrency: string, toCurrency: string, amount: string): Promise<ExchangeRate> {
  try {
    const response = await fetch(
      `${API_URL}/exchange-amount/${amount}/${fromCurrency.toLowerCase()}_${toCurrency.toLowerCase()}?api_key=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Failed to get exchange rate');
    }

    const data = await response.json();
    return {
      estimatedAmount: data.estimatedAmount,
      rate: data.rate,
      transactionSpeedForecast: "15-30 minutes"
    };
  } catch (error) {
    console.error('Exchange rate error:', error);
    throw error;
  }
}