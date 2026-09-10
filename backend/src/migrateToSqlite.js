require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { DatabaseSync } = require('node:sqlite');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to copy from Postgres.');
  process.exit(1);
}

const sqlitePath = path.resolve(process.env.DATABASE_PATH || './data/avtracker.db');
fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
if (fs.existsSync(sqlitePath)) {
  fs.copyFileSync(sqlitePath, `${sqlitePath}.bak-${Date.now()}`);
}

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
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
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

async function copy() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sqlite = new DatabaseSync(sqlitePath);
  sqlite.exec('PRAGMA foreign_keys = OFF');
  sqlite.exec('DROP TABLE IF EXISTS hardware');
  sqlite.exec('DROP TABLE IF EXISTS conference_rooms');
  sqlite.exec('DROP TABLE IF EXISTS offices');
  sqlite.exec('DROP TABLE IF EXISTS users');
  sqlite.exec('DROP TABLE IF EXISTS shelf_stock');
  sqlite.exec(SQLITE_SCHEMA);

  const tables = [
    {
      name: 'offices',
      columns: ['id', 'name', 'created_at'],
    },
    {
      name: 'conference_rooms',
      columns: ['id', 'office_id', 'name', 'status', 'created_at'],
    },
    {
      name: 'hardware',
      columns: [
        'id',
        'conference_room_id',
        'manufacturer',
        'model',
        'description',
        'estimated_replacement_cost',
        'mac_address',
        'ip_address',
        'serial_number',
        'software_version',
        'username',
        'password_encrypted',
        'importance_level',
        'end_of_support_date',
        'end_of_warranty_date',
        'upgrade_recommendations',
        'created_at',
        'updated_at',
      ],
    },
    {
      name: 'users',
      columns: ['id', 'username', 'password_hash', 'role', 'totp_secret', 'totp_enabled', 'created_at'],
    },
    {
      name: 'shelf_stock',
      columns: ['id', 'manufacturer', 'model', 'quantity', 'location', 'notes', 'created_at', 'updated_at'],
    },
  ];

  const counts = {};
  for (const table of tables) {
    const result = await pool.query(`SELECT ${table.columns.join(', ')} FROM ${table.name} ORDER BY id`);
    const insert = sqlite.prepare(
      `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${table.columns.map(() => '?').join(', ')})`
    );
    for (const row of result.rows) {
      insert.run(...table.columns.map((column) => row[column] ?? null));
    }
    counts[table.name] = result.rows.length;
  }

  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.close();
  await pool.end();
  console.log(`Copied to ${sqlitePath}`, counts);
}

copy().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
