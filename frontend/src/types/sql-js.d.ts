declare module 'sql.js' {
  export interface Statement {
    bind(values?: any[] | Record<string, any>): boolean;
    step(): boolean;
    getAsObject(params?: any[] | Record<string, any>): Record<string, any>;
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Uint8Array | null);
    run(sql: string, params?: any[] | Record<string, any>): Database;
    prepare(sql: string, params?: any[] | Record<string, any>): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
