const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './data/avtracker.db';
const resolvedPath = path.resolve(dbPath);
const dir = path.dirname(resolvedPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new DatabaseSync(resolvedPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS offices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conference_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    office_id INTEGER NOT NULL,
    name TEXT NOT NULL,
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
`);

const hardwareColumns = db.prepare('PRAGMA table_info(hardware)').all();
if (!hardwareColumns.some((col) => col.name === 'end_of_warranty_date')) {
  db.exec('ALTER TABLE hardware ADD COLUMN end_of_warranty_date TEXT');
}

module.exports = db;
