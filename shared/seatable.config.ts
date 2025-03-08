import { z } from "zod";

export const SEATABLE_CONFIG = {
  SERVER_URL: process.env.SEATABLE_SERVER_URL || 'https://cloud.seatable.io',
  API_TOKEN: process.env.SEATABLE_API_TOKEN,
  WORKSPACE_ID: process.env.SEATABLE_WORKSPACE_ID || '55290',
  BASE_NAME: process.env.SEATABLE_BASE_NAME || 'FinancialPlatform'
};

export type SeaTableColumn = {
  name: string;
  type: 'text' | 'number' | 'date' | 'single-select' | 'multiple-select' | 'formula' | 'link';
  data?: any;
};

export type SeaTableTable = {
  name: string;
  columns: SeaTableColumn[];
};

export const DEFAULT_TABLES: SeaTableTable[] = [
  {
    name: 'Transactions',
    columns: [
      { name: 'transaction_id', type: 'text' },
      { name: 'from_card_id', type: 'text' },
      { name: 'to_card_id', type: 'text' },
      { name: 'amount', type: 'number' },
      { name: 'converted_amount', type: 'number' },
      { name: 'currency_type', type: 'single-select', data: ['btc', 'eth', 'usd', 'uah'] },
      { name: 'type', type: 'single-select', data: ['transfer', 'commission', 'exchange'] },
      { name: 'status', type: 'single-select', data: ['pending', 'completed', 'failed'] },
      { name: 'wallet_address', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'created_at', type: 'date' }
    ]
  },
  {
    name: 'Cards',
    columns: [
      { name: 'card_id', type: 'text' },
      { name: 'user_id', type: 'text' },
      { name: 'number', type: 'text' },
      { name: 'type', type: 'single-select', data: ['crypto', 'usd', 'uah'] },
      { name: 'balance', type: 'number' },
      { name: 'btc_balance', type: 'number' },
      { name: 'eth_balance', type: 'number' },
      { name: 'btc_address', type: 'text' },
      { name: 'eth_address', type: 'text' },
      { name: 'expiry', type: 'text' },
      { name: 'cvv', type: 'text' },
      { name: 'status', type: 'single-select', data: ['active', 'blocked', 'expired'] }
    ]
  },
  {
    name: 'Users',
    columns: [
      { name: 'user_id', type: 'text' },
      { name: 'username', type: 'text' },
      { name: 'status', type: 'single-select', data: ['active', 'inactive', 'suspended'] },
      { name: 'created_at', type: 'date' },
      { name: 'is_regulator', type: 'number' }
    ]
  }
];