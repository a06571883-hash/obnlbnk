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
  cryptoCard?: {
    btcBalance: string;
    ethBalance: string;
    btcAddress: string;
  };
}

// Simple card number validation - only checks format
function validateCardFormat(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');
  return cleanNumber.length === 16 && /^\d+$/.test(cleanNumber);
}

export async function createExchangeTransaction(params: CreateTransaction) {
  try {
    if (!params.cryptoCard) {
      throw new Error('Криптовалютный кошелек не найден');
    }

    // Check available balance
    const amount = parseFloat(params.fromAmount);
    const balance = params.fromCurrency === 'btc' ? 
      parseFloat(params.cryptoCard.btcBalance) : 
      parseFloat(params.cryptoCard.ethBalance);

    // Validate real balance (not virtual)
    const minBalance = 0.0001; // Minimum balance threshold to prevent test transactions
    if (balance < minBalance) {
      throw new Error(
        `Для вывода средств необходимо иметь реальный баланс криптовалюты. ` +
        `Пополните ваш ${params.fromCurrency.toUpperCase()} кошелек для продолжения операции.`
      );
    }

    if (amount > balance) {
      throw new Error(
        `Недостаточно ${params.fromCurrency.toUpperCase()}. Доступно: ${balance}`
      );
    }

    const cleanCardNumber = params.address.replace(/[\s-]/g, '');
    if (!validateCardFormat(cleanCardNumber)) {
      throw new Error('Пожалуйста, введите корректный 16-значный номер карты');
    }

    // Get minimum amount from ChangeNow
    const minAmountResponse = await fetch(
      `${API_URL}/min-amount/${params.fromCurrency.toLowerCase()}_uah?api_key=${API_KEY}`
    );

    if (!minAmountResponse.ok) {
      console.error('ChangeNow API error:', await minAmountResponse.text());
      throw new Error('Не удалось получить минимальную сумму обмена. Пожалуйста, попробуйте позже.');
    }

    const minAmountData = await minAmountResponse.json() as { minAmount: string };
    if (amount < parseFloat(minAmountData.minAmount)) {
      throw new Error(
        `Минимальная сумма для обмена: ${minAmountData.minAmount} ${params.fromCurrency.toUpperCase()}`
      );
    }

    // Create exchange request with ChangeNow
    const requestBody = {
      from: params.fromCurrency.toLowerCase(),
      to: "uah",
      amount: params.fromAmount,
      address: cleanCardNumber,
      refundAddress: params.cryptoCard.btcAddress,
      payoutCurrency: "UAH",
      payoutMethod: "bank_card",
      bankDetails: {
        cardNumber: cleanCardNumber,
        country: "UA"
      }
    };

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
      console.error('ChangeNow API error:', errorText);
      throw new Error('Ошибка при создании обмена. Пожалуйста, попробуйте позже.');
    }

    const result = await response.json() as {
      id: string;
      status: string;
      expectedReceiveAmount: string;
      payinAddress: string;
    };

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

export async function getExchangeRate(fromCurrency: string, toCurrency: string, amount: string): Promise<ExchangeRate> {
  try {
    const response = await fetch(
      `${API_URL}/exchange-amount/${amount}/${fromCurrency.toLowerCase()}_${toCurrency.toLowerCase()}?api_key=${API_KEY}`
    );

    if (!response.ok) {
      console.error('Rate fetch error:', await response.text());
      throw new Error('Не удалось получить курс обмена');
    }

    const data = await response.json() as {
      estimatedAmount: string;
      rate: string;
    };
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

export async function getTransactionStatus(id: string) {
  try {
    const response = await fetch(`${API_URL}/transactions/${id}`, {
      headers: {
        'x-api-key': API_KEY!
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
      throw new Error(error.message || 'Failed to get transaction status');
    }

    return response.json();
  } catch (error) {
    console.error('Transaction status error:', error);
    throw error;
  }
}