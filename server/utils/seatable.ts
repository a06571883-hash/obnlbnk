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

    this.base = new Base({
      server: SEATABLE_CONFIG.SERVER_URL,
      APIToken: SEATABLE_CONFIG.API_TOKEN,
      workspaceID: SEATABLE_CONFIG.WORKSPACE_ID
    });

    await this.base.auth();
  }

  public async createTable(table: SeaTableTable) {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      await this.base.addTable({
        table_name: table.name,
        columns: table.columns.map(col => ({
          column_name: col.name,
          column_type: col.type,
          column_data: col.data
        }))
      });
    } catch (error) {
      console.error(`Error creating table ${table.name}:`, error);
      throw error;
    }
  }

  public async syncFromSeaTable() {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      console.log('Starting data retrieval from SeaTable...');

      // Получаем данные пользователей
      const usersData = await this.query('Users', {});
      console.log(`Retrieved ${usersData.length} users from SeaTable`);

      // Получаем данные карт
      const cardsData = await this.query('Cards', {});
      console.log(`Retrieved ${cardsData.length} cards from SeaTable`);

      // Получаем данные транзакций
      const transactionsData = await this.query('Transactions', {});
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

  public async query(tableName: string, query: object = {}) {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      return await this.base.query(tableName, query);
    } catch (error) {
      console.error(`Error querying table ${tableName}:`, error);
      throw error;
    }
  }

  public async insert(tableName: string, row: object) {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      return await this.base.addRow(tableName, row);
    } catch (error) {
      console.error(`Error inserting into table ${tableName}:`, error);
      throw error;
    }
  }

  public async update(tableName: string, rowId: string, updates: object) {
    if (!this.base) {
      throw new Error('SeaTable base is not initialized');
    }

    try {
      return await this.base.updateRow(tableName, rowId, updates);
    } catch (error) {
      console.error(`Error updating row in table ${tableName}:`, error);
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