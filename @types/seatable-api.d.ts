declare module 'seatable-api' {
  export class Base {
    constructor(options: any);
    auth(): Promise<void>;
    listTables(): Promise<any[]>;
    listRows(tableName: string): Promise<any[]>;
    appendRow(tableName: string, rowData: any): Promise<any>;
    updateRow(tableName: string, rowId: string, rowData: any): Promise<any>;
    deleteRow(tableName: string, rowId: string): Promise<void>;
  }
}