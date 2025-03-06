export const SEATABLE_CONFIG = {
  SERVER_URL: process.env.SEATABLE_SERVER_URL || 'https://cloud.seatable.io',
  API_TOKEN: process.env.SEATABLE_API_TOKEN,
  WORKSPACE_ID: process.env.SEATABLE_WORKSPACE_ID,
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
      { name: 'user_id', type: 'text' },
      { name: 'amount', type: 'number' },
      { name: 'currency', type: 'text' },
      { name: 'type', type: 'single-select', data: ['deposit', 'withdrawal', 'transfer'] },
      { name: 'status', type: 'single-select', data: ['pending', 'completed', 'failed'] },
      { name: 'created_at', type: 'date' }
    ]
  },
  {
    name: 'Users',
    columns: [
      { name: 'user_id', type: 'text' },
      { name: 'username', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'status', type: 'single-select', data: ['active', 'inactive', 'suspended'] },
      { name: 'created_at', type: 'date' }
    ]
  }
];
