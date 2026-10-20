// src/services/sqlite.ts
import initSqlJs, { type Database } from 'sql.js';

const IDB_NAME = 'RachAppSQLiteDB';
const IDB_STORE = 'sqlite_store';
const IDB_KEY = 'rachapp.sqlite';

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadBinaryFromIndexedDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        idb.close();
        if (req.result instanceof Uint8Array) {
          resolve(req.result);
        } else if (req.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(req.result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        idb.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('Aviso ao ler binário SQLite:', err);
    return null;
  }
}

export async function flushSQLite(): Promise<void> {
  if (!dbInstance) return;
  try {
    const binary = dbInstance.export();
    const idb = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(binary, IDB_KEY);
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('Erro ao persistir banco SQLite:', err);
  }
}

function createSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS auth_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      token TEXT,
      user_id TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      pix_key TEXT,
      phone_verified INTEGER DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS friends (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      pix_key TEXT,
      color TEXT NOT NULL,
      is_favorite INTEGER DEFAULT 0,
      has_account INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS groups_table (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT,
      friend_id TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      created_by_user_id TEXT,
      group_id TEXT,
      paid_by_friend_id TEXT,
      title TEXT NOT NULL,
      tag TEXT,
      total_amount REAL NOT NULL,
      self_amount_owed REAL DEFAULT 0,
      self_amount_paid REAL DEFAULT 0,
      self_receipt_url TEXT,
      expense_date TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expense_participants (
      expense_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      amount_owed REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      receipt_url TEXT,
      PRIMARY KEY (expense_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Migrações incrementais para bancos SQLite locais já existentes
    try {
    db.run('ALTER TABLE expenses ADD COLUMN created_by_user_id TEXT');
  } catch {
    // Coluna já existe
  }

  try {
    db.run('ALTER TABLE expenses ADD COLUMN self_receipt_url TEXT');
  } catch {
    // Coluna já existe
  }

  try {
    db.run('ALTER TABLE expense_participants ADD COLUMN receipt_url TEXT');
  } catch {
    // Coluna já existe
  }

  try {
    db.run('ALTER TABLE friends ADD COLUMN has_account INTEGER DEFAULT 0');
  } catch {
    // Coluna já existe
  }
}

export async function getSQLiteDB(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });

    const savedBytes = await loadBinaryFromIndexedDB();
    const db = savedBytes ? new SQL.Database(savedBytes) : new SQL.Database();

    createSchema(db);
    dbInstance = db;
    await flushSQLite();
    return db;
  })();

  return initPromise;
}

export async function runSQL(sql: string, params: any[] = [], shouldFlush = true): Promise<void> {
  const db = await getSQLiteDB();
  db.run(sql, params);
  if (shouldFlush) {
    await flushSQLite();
  }
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getSQLiteDB();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}
