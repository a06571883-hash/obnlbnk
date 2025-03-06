import { Base } from 'seatable-api';
import { SEATABLE_CONFIG, SeaTableTable } from '@shared/seatable.config';

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
}

export const seaTableManager = SeaTableManager.getInstance();
