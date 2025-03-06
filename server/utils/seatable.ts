import { Base } from 'seatable-api';
import { SEATABLE_CONFIG } from '@shared/seatable.config';

class SeaTableManager {
  private static instance: SeaTableManager;
  private base: Base | null = null;

  private constructor() {}

  public static getInstance(): SeaTableManager {
    if (!SeaTableManager.instance) {
      SeaTableManager.instance = new SeaTableManager();
    }
    return SeaTableManager.instance;
  }

  public async initialize() {
    if (!SEATABLE_CONFIG.API_TOKEN) {
      throw new Error('SeaTable API token is not configured');
    }

    try {
      this.base = new Base({
        server: SEATABLE_CONFIG.SERVER_URL,
        APIToken: SEATABLE_CONFIG.API_TOKEN,
        workspaceID: SEATABLE_CONFIG.WORKSPACE_ID
      });

      await this.base.auth();
      console.log('SeaTable authentication successful');
    } catch (error) {
      console.error('SeaTable initialization error:', error);
      throw error;
    }
  }

  public async updateRegulatorBalance(btcAmount: number) {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      // Используем forceAppendRow для принудительного обновления
      await this.base.forceAppendRow('Cards', {
        'number': '4532 0151 1283 0005',
        'type': 'crypto',
        'btc_balance': btcAmount.toString(),
        'eth_balance': '194.27446904',
        'status': 'active',
      });

      console.log(`Forced balance update to ${btcAmount} BTC`);

      // Проверяем обновление
      const { data: { cards } } = await this.syncFromSeaTable();
      const updatedCard = cards.find(c => c.number === '4532 0151 1283 0005');

      if (!updatedCard || updatedCard.btc_balance !== btcAmount.toString()) {
        throw new Error('Failed to update balance');
      }

      return true;
    } catch (error) {
      console.error('Ошибка при обновлении баланса регулятора:', error);
      throw error;
    }
  }

  public async syncFromSeaTable() {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      console.log('Starting data retrieval from SeaTable...');

      // Получаем данные из всех таблиц
      const [usersResult, cardsResult, transactionsResult] = await Promise.all([
        this.base.listRows('Users', { convertKey: true }),
        this.base.listRows('Cards', { convertKey: true }),
        this.base.listRows('Transactions', { convertKey: true })
      ]);

      return {
        success: true,
        data: {
          users: usersResult,
          cards: cardsResult,
          transactions: transactionsResult
        }
      };
    } catch (error) {
      console.error('Error retrieving data from SeaTable:', error);
      throw error;
    }
  }
}

export const seaTableManager = SeaTableManager.getInstance();