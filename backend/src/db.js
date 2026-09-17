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
    issue_description TEXT,
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

  CREATE TABLE IF NOT EXISTS hardware_rooms (
    hardware_id INTEGER NOT NULL,
    conference_room_id INTEGER NOT NULL,
    PRIMARY KEY (hardware_id, conference_room_id),
    FOREIGN KEY (hardware_id) REFERENCES hardware(id) ON DELETE CASCADE,
    FOREIGN KEY (conference_room_id) REFERENCES conference_rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    must_setup_totp INTEGER NOT NULL DEFAULT 0,
    mfa_required INTEGER NOT NULL DEFAULT 0,
    disabled INTEGER NOT NULL DEFAULT 0,
    permissions TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shelf_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    location TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    issue_description TEXT,
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

  CREATE TABLE IF NOT EXISTS hardware_rooms (
    hardware_id INTEGER NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    conference_room_id INTEGER NOT NULL REFERENCES conference_rooms(id) ON DELETE CASCADE,
    PRIMARY KEY (hardware_id, conference_room_id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    must_setup_totp INTEGER NOT NULL DEFAULT 0,
    mfa_required INTEGER NOT NULL DEFAULT 0,
    disabled INTEGER NOT NULL DEFAULT 0,
    permissions TEXT,
    created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
  );

  CREATE TABLE IF NOT EXISTS shelf_stock (
    id SERIAL PRIMARY KEY,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    location TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
    updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
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
    // Hardware EOS/warranty columns are TEXT; compare as YYYY-MM-DD strings, not timestamps.
    .replace(/date\('now',\s*'\+90 days'\)/gi, "to_char((CURRENT_DATE + INTERVAL '90 days')::date, 'YYYY-MM-DD')")
    .replace(/date\('now'\)/gi, "to_char(CURRENT_DATE, 'YYYY-MM-DD')")
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
      (key === 'id' || key === 'quantity' || key.endsWith('_id') || key.endsWith('_count'))
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
  if (!roomColumns.some((col) => col.name === 'issue_description')) {
    db.exec('ALTER TABLE conference_rooms ADD COLUMN issue_description TEXT');
  }

  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  if (!userColumns.some((col) => col.name === 'totp_secret')) {
    db.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT');
  }
  if (!userColumns.some((col) => col.name === 'totp_enabled')) {
    db.exec('ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!userColumns.some((col) => col.name === 'must_change_password')) {
    db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
  }
  if (!userColumns.some((col) => col.name === 'must_setup_totp')) {
    db.exec('ALTER TABLE users ADD COLUMN must_setup_totp INTEGER NOT NULL DEFAULT 0');
  }
  if (!userColumns.some((col) => col.name === 'mfa_required')) {
    db.exec('ALTER TABLE users ADD COLUMN mfa_required INTEGER NOT NULL DEFAULT 0');
  }
  if (!userColumns.some((col) => col.name === 'disabled')) {
    db.exec('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!userColumns.some((col) => col.name === 'permissions')) {
    db.exec('ALTER TABLE users ADD COLUMN permissions TEXT');
  }

  db.exec(`
    INSERT INTO hardware_rooms (hardware_id, conference_room_id)
    SELECT h.id, h.conference_room_id
    FROM hardware h
    WHERE h.conference_room_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM hardware_rooms hr
        WHERE hr.hardware_id = h.id AND hr.conference_room_id = h.conference_room_id
      )
  `);

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
        query = `${sql.replace(/;?\s*$/, '')} RETURNING *`;
      }
      const result = await pool.query(toPostgresSql(query), params);
      const row = result.rows[0];
      return {
        lastInsertRowid: row && row.id != null ? Number(row.id) : undefined,
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
  await pgDriver.exec('ALTER TABLE conference_rooms ADD COLUMN IF NOT EXISTS issue_description TEXT');
  await pgDriver.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT');
  await pgDriver.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled INTEGER NOT NULL DEFAULT 0');
  await pgDriver.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password INTEGER NOT NULL DEFAULT 0');
  await pgDriver.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS must_setup_totp INTEGER NOT NULL DEFAULT 0');
  await pgDriver.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_required INTEGER NOT NULL DEFAULT 0');
  await pgDriver.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled INTEGER NOT NULL DEFAULT 0');
  await pgDriver.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT');
  await pgDriver.exec(`
    INSERT INTO hardware_rooms (hardware_id, conference_room_id)
    SELECT h.id, h.conference_room_id
    FROM hardware h
    WHERE h.conference_room_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM hardware_rooms hr
        WHERE hr.hardware_id = h.id AND hr.conference_room_id = h.conference_room_id
      )
  `);
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
