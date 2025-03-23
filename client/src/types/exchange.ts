// Типы данных для операций обмена валюты

// Тип для запроса на обмен валюты
export interface ExchangeRequest {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  address: string;
  cryptoCard?: {
    btcBalance: string;
    ethBalance: string;
    btcAddress?: string | null;
    ethAddress?: string | null;
  };
}

// Тип для ответа обменного курса
export interface ExchangeRateResponse {
  estimatedAmount: string;
  rate: string;
  transactionSpeedForecast: string;
}

// Тип для ответа создания обмена
export interface ExchangeResponse {
  id: string;
  status: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  expectedAmount: string;
  payinAddress: string;
  payoutAddress: string;
}

// Тип для статуса обмена
export interface ExchangeStatus {
  id: string;
  status: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  expectedReceiveAmount: string;
  actualReceiveAmount?: string;
  createdAt: string;
  updatedAt: string;
}