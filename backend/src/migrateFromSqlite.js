/**
 * Copy local SQLite data into Cloud SQL (Postgres).
 *
 * Usage (from backend/, with Cloud SQL Auth Proxy on 5432):
 *   set DATABASE_PATH=./data/avtracker.db
 *   set DB_HOST=127.0.0.1
 *   set DB_USER=postgres
 *   set DB_PASS=...
 *   set DB_NAME=avtracker
 *   node src/migrateFromSqlite.js
 */
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { DatabaseSync } = require('node:sqlite');

const sqlitePath = path.resolve(process.env.DATABASE_PATH || './data/avtracker.db');

if (!fs.existsSync(sqlitePath)) {
  console.error(`SQLite file not found: ${sqlitePath}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL && !process.env.DB_HOST && !process.env.INSTANCE_CONNECTION_NAME) {
  console.error('Set DATABASE_URL or DB_HOST / INSTANCE_CONNECTION_NAME for the Postgres target.');
  process.exit(1);
}

function pgConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'avtracker',
  };
  if (process.env.INSTANCE_CONNECTION_NAME) {
    config.host = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
  } else {
    config.host = process.env.DB_HOST || '127.0.0.1';
    config.port = Number(process.env.DB_PORT) || 5432;
  }
  return config;
}

async function resetSequence(client, table) {
  await client.query(
    `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
    [table]
  );
}

async function main() {
  const db = require('./db');
  await db.init();
  await db.close();

  const sqlite = new DatabaseSync(sqlitePath);
  const pool = new Pool(pgConfig());
  const client = await pool.connect();

  const offices = sqlite.prepare('SELECT * FROM offices').all();
  const rooms = sqlite.prepare('SELECT * FROM conference_rooms').all();
  const hardware = sqlite.prepare('SELECT * FROM hardware').all();
  const users = sqlite.prepare('SELECT * FROM users').all();
  const stock = sqlite.prepare('SELECT * FROM shelf_stock').all();
  let hardwareRooms = [];
  try {
    hardwareRooms = sqlite.prepare('SELECT * FROM hardware_rooms').all();
  } catch {
    hardwareRooms = [];
  }

  console.log(
    `Copying ${offices.length} offices, ${rooms.length} rooms, ${hardware.length} hardware, ${users.length} users, ${stock.length} shelf stock, ${hardwareRooms.length} hardware rooms from ${sqlitePath}`
  );

  try {
    await client.query('BEGIN');
    await client.query(
      'TRUNCATE hardware_rooms, hardware, conference_rooms, offices, users, shelf_stock RESTART IDENTITY CASCADE'
    );

    for (const row of offices) {
      await client.query('INSERT INTO offices (id, name, created_at) VALUES ($1, $2, $3)', [
        row.id,
        row.name,
        row.created_at,
      ]);
    }

    for (const row of rooms) {
      await client.query(
        'INSERT INTO conference_rooms (id, office_id, name, status, issue_description, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [row.id, row.office_id, row.name, row.status || 'functional', row.issue_description || null, row.created_at]
      );
    }

    for (const row of hardware) {
      await client.query(
        `INSERT INTO hardware (
          id, conference_room_id, manufacturer, model, description, estimated_replacement_cost,
          mac_address, ip_address, serial_number, software_version, username, password_encrypted,
          importance_level, end_of_support_date, end_of_warranty_date, upgrade_recommendations,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          row.id,
          row.conference_room_id,
          row.manufacturer,
          row.model,
          row.description,
          row.estimated_replacement_cost,
          row.mac_address,
          row.ip_address,
          row.serial_number,
          row.software_version,
          row.username,
          row.password_encrypted,
          row.importance_level,
          row.end_of_support_date,
          row.end_of_warranty_date,
          row.upgrade_recommendations,
          row.created_at,
          row.updated_at,
        ]
      );
    }

    for (const row of hardwareRooms) {
      await client.query('INSERT INTO hardware_rooms (hardware_id, conference_room_id) VALUES ($1, $2)', [
        row.hardware_id,
        row.conference_room_id,
      ]);
    }

    for (const row of users) {
      await client.query(
        `INSERT INTO users (id, username, password_hash, role, totp_secret, totp_enabled, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          row.id,
          row.username,
          row.password_hash,
          row.role,
          row.totp_secret || null,
          row.totp_enabled ? 1 : 0,
          row.created_at,
        ]
      );
    }

    for (const row of stock) {
      await client.query(
        `INSERT INTO shelf_stock (id, manufacturer, model, quantity, location, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          row.id,
          row.manufacturer,
          row.model,
          row.quantity,
          row.location || null,
          row.notes || null,
          row.created_at,
          row.updated_at,
        ]
      );
    }

    await resetSequence(client, 'offices');
    await resetSequence(client, 'conference_rooms');
    await resetSequence(client, 'hardware');
    await resetSequence(client, 'users');
    await resetSequence(client, 'shelf_stock');
    await client.query('COMMIT');
    console.log('Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main();
