const path = require('path');
const fs = require('fs');

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS offices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conference_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    office_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'functional' CHECK (status IN ('functional', 'issue')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE,
    UNIQUE (office_id, name)
  );

  CREATE TABLE IF NOT EXISTS hardware (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conference_room_id INTEGER,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    description TEXT,
    estimated_replacement_cost REAL,
    mac_address TEXT,
    ip_address TEXT,
    serial_number TEXT,
    software_version TEXT,
    username TEXT,
    password_encrypted TEXT,
    importance_level TEXT NOT NULL CHECK (importance_level IN ('low', 'medium', 'high', 'critical')),
    end_of_support_date TEXT,
    end_of_warranty_date TEXT,
    upgrade_recommendations TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conference_room_id) REFERENCES conference_rooms(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const POSTGRES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS offices (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
  );

  CREATE TABLE IF NOT EXISTS conference_rooms (
    id SERIAL PRIMARY KEY,
    office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'functional' CHECK (status IN ('functional', 'issue')),
    created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
    UNIQUE (office_id, name)
  );

  CREATE TABLE IF NOT EXISTS hardware (
    id SERIAL PRIMARY KEY,
    conference_room_id INTEGER REFERENCES conference_rooms(id) ON DELETE SET NULL,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    description TEXT,
    estimated_replacement_cost DOUBLE PRECISION,
    mac_address TEXT,
    ip_address TEXT,
    serial_number TEXT,
    software_version TEXT,
    username TEXT,
    password_encrypted TEXT,
    importance_level TEXT NOT NULL CHECK (importance_level IN ('low', 'medium', 'high', 'critical')),
    end_of_support_date TEXT,
    end_of_warranty_date TEXT,
    upgrade_recommendations TEXT,
    created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
    updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
  );

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
  );
`;

let dialect = 'sqlite';
let driver;

function usePostgres() {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.INSTANCE_CONNECTION_NAME ||
      process.env.DB_HOST
  );
}

function toPostgresSql(sql) {
  let n = 0;
  return sql
    .replace(/datetime\('now'\)/gi, "TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')")
    .replace(/date\('now',\s*'\+90 days'\)/gi, "(CURRENT_DATE + INTERVAL '90 days')")
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/\?/g, () => `$${++n}`);
}

function normalizeRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'bigint') {
      out[key] = Number(value);
    } else if (
      typeof value === 'string' &&
      /^-?\d+$/.test(value) &&
      (key === 'id' || key.endsWith('_id') || key.endsWith('_count'))
    ) {
      out[key] = Number(value);
    }
  }
  return out;
}

function createPgPool() {
  const { Pool } = require('pg');

  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }

  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'avtracker',
    max: 5,
  };

  if (process.env.INSTANCE_CONNECTION_NAME) {
    config.host = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
  } else {
    config.host = process.env.DB_HOST || '127.0.0.1';
    config.port = Number(process.env.DB_PORT) || 5432;
  }

  return new Pool(config);
}

function createSqliteDriver() {
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = process.env.DATABASE_PATH || './data/avtracker.db';
  const resolvedPath = path.resolve(dbPath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SQLITE_SCHEMA);

  const hardwareColumns = db.prepare('PRAGMA table_info(hardware)').all();
  if (!hardwareColumns.some((col) => col.name === 'end_of_warranty_date')) {
    db.exec('ALTER TABLE hardware ADD COLUMN end_of_warranty_date TEXT');
  }

  const roomColumns = db.prepare('PRAGMA table_info(conference_rooms)').all();
  if (!roomColumns.some((col) => col.name === 'status')) {
    db.exec(
      "ALTER TABLE conference_rooms ADD COLUMN status TEXT NOT NULL DEFAULT 'functional' CHECK (status IN ('functional', 'issue'))"
    );
  }

  return {
    async all(sql, params) {
      return db.prepare(sql).all(...params).map(normalizeRow);
    },
    async get(sql, params) {
      return normalizeRow(db.prepare(sql).get(...params));
    },
    async run(sql, params) {
      const result = db.prepare(sql).run(...params);
      return {
        lastInsertRowid: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async exec(sql) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
  };
}

function createPostgresDriver(pool) {
  return {
    async all(sql, params) {
      const result = await pool.query(toPostgresSql(sql), params);
      return result.rows.map(normalizeRow);
    },
    async get(sql, params) {
      const result = await pool.query(toPostgresSql(sql), params);
      return normalizeRow(result.rows[0]);
    },
    async run(sql, params) {
      let query = sql;
      const isInsert = /^\s*INSERT/i.test(sql) && !/RETURNING/i.test(sql);
      if (isInsert) {
        query = `${sql.replace(/;?\s*$/, '')} RETURNING id`;
      }
      const result = await pool.query(toPostgresSql(query), params);
      return {
        lastInsertRowid: result.rows[0] ? Number(result.rows[0].id) : undefined,
        changes: result.rowCount,
      };
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

async function initPostgresSchema(pgDriver) {
  await pgDriver.exec(POSTGRES_SCHEMA);
  await pgDriver.exec('ALTER TABLE hardware ADD COLUMN IF NOT EXISTS end_of_warranty_date TEXT');
  await pgDriver.exec(
    "ALTER TABLE conference_rooms ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'functional'"
  );
}

async function init() {
  if (driver) return;

  if (usePostgres()) {
    dialect = 'postgres';
    const pool = createPgPool();
    driver = createPostgresDriver(pool);
    await initPostgresSchema(driver);
    return;
  }

  dialect = 'sqlite';
  driver = createSqliteDriver();
}

function prepare(sql) {
  return {
    all: (...params) => driver.all(sql, params),
    get: (...params) => driver.get(sql, params),
    run: (...params) => driver.run(sql, params),
  };
}

function isUniqueViolation(err) {
  if (!err) return false;
  if (err.code === '23505') return true;
  return /unique/i.test(err.message || '');
}

function getDialect() {
  return dialect;
}

async function close() {
  if (driver) {
    await driver.close();
    driver = undefined;
  }
}

module.exports = {
  init,
  close,
  prepare,
  isUniqueViolation,
  getDialect,
  usePostgres,
};
