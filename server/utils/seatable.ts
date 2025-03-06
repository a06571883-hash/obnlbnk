import { Base } from 'seatable-api';
import { SEATABLE_CONFIG, SeaTableTable } from '@shared/seatable.config';
import { db } from '../db';
import { users, cards, transactions } from '@shared/schema';

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
      // Получаем данные всех таблиц
      const currentData = await this.syncFromSeaTable();
      console.log('Current data from SeaTable:', currentData);

      // Находим регулятора
      const regulator = currentData.data.users.find(user => user.is_regulator === true);
      if (!regulator) {
        throw new Error('Регулятор не найден в SeaTable');
      }
      console.log('Found regulator:', regulator);

      // Находим крипто-карту регулятора
      const cryptoCard = currentData.data.cards.find(
        card => card.user_id === regulator.user_id && card.type === 'crypto'
      );
      if (!cryptoCard) {
        throw new Error('Криптокарта регулятора не найдена');
      }
      console.log('Found crypto card:', cryptoCard);

      // Показываем текущий баланс
      console.log('Current BTC balance:', cryptoCard.btc_balance);

      // Обновляем данные напрямую через API
      await this.base.updateRow('Cards', cryptoCard._id, {
        'btc_balance': btcAmount.toString()
      });

      // Проверяем обновление
      const updatedData = await this.syncFromSeaTable();
      const updatedCard = updatedData.data.cards.find(card => card._id === cryptoCard._id);
      console.log('Updated BTC balance:', updatedCard?.btc_balance);

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

      // Получаем данные из всех таблиц через SQL
      const queries = {
        users: { sql: 'SELECT * FROM Users' },
        cards: { sql: 'SELECT * FROM Cards' },
        transactions: { sql: 'SELECT * FROM Transactions' }
      };

      console.log('Executing queries:', queries);

      const [usersResult, cardsResult, transactionsResult] = await Promise.all([
        this.base.query(queries.users),
        this.base.query(queries.cards),
        this.base.query(queries.transactions)
      ]);

      const usersData = usersResult.results;
      const cardsData = cardsResult.results;
      const transactionsData = transactionsResult.results;

      console.log(`Retrieved ${usersData.length} users from SeaTable`);
      console.log(`Retrieved ${cardsData.length} cards from SeaTable`);
      console.log(`Retrieved ${transactionsData.length} transactions from SeaTable`);

      return {
        success: true,
        data: {
          users: usersData,
          cards: cardsData,
          transactions: transactionsData
        }
      };
    } catch (error) {
      console.error('Error retrieving data from SeaTable:', error);
      throw error;
    }
  }
  public async listTables() {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      console.log('Listing all tables...');
      const tables = await this.base.listTables();
      console.log('Available tables:', tables);
      return tables;
    } catch (error) {
      console.error('Error listing tables:', error);
      throw error;
    }
  }
  public async query(tableName: string, query: any = {}) {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      console.log(`Executing SQL query for table ${tableName}`);
      const sql = `SELECT * FROM "${tableName}"`;
      console.log('SQL Query:', sql);

      const result = await this.base.query({
        sql: sql
      });

      console.log(`Query result for ${tableName}:`, result);
      return result.results;
    } catch (error) {
      console.error(`Error querying table ${tableName}:`, error);
      throw error;
    }
  }
  public async insert(tableName: string, data: any) {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      console.log(`Inserting data into table ${tableName}:`, data);
      const result = await this.base.insert(tableName, data);
      console.log(`Data inserted successfully into ${tableName}:`, result);
      return result;
    } catch (error) {
      console.error(`Error inserting data into table ${tableName}:`, error);
      throw error;
    }
  }
  public async syncFromPostgres() {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      console.log('Starting data sync from PostgreSQL to SeaTable...');

      // Sync Users
      const usersData = await db.select().from(users);
      for (const user of usersData) {
        await this.insert('Users', {
          user_id: user.id.toString(),
          username: user.username,
          email: user.email || '',
          status: user.is_regulator ? 'active' : 'inactive',
          created_at: new Date().toISOString()
        });
      }
      console.log(`Synced ${usersData.length} users`);

      // Sync Cards
      const cardsData = await db.select().from(cards);
      for (const card of cardsData) {
        const status = card.balance > 0 ? 'active' : 'inactive';
        await this.insert('Cards', {
          card_id: card.id.toString(),
          user_id: card.userId.toString(),
          type: card.type,
          number: card.number,
          balance: card.balance.toString(),
          status: status,
          created_at: new Date().toISOString()
        });
      }
      console.log(`Synced ${cardsData.length} cards`);

      // Sync Transactions
      const transactionsData = await db.select().from(transactions);
      for (const tx of transactionsData) {
        await this.insert('Transactions', {
          transaction_id: tx.id.toString(),
          from_card_id: tx.fromCardId.toString(),
          to_card_id: tx.toCardId?.toString() || '',
          amount: tx.amount.toString(),
          type: tx.type,
          status: tx.status,
          created_at: tx.createdAt.toISOString()
        });
      }
      console.log(`Synced ${transactionsData.length} transactions`);

      return {
        success: true,
        stats: {
          users: usersData.length,
          cards: cardsData.length,
          transactions: transactionsData.length
        }
      };
    } catch (error) {
      console.error('Error syncing data to SeaTable:', error);
      throw error;
    }
  }
}

export const seaTableManager = SeaTableManager.getInstance();