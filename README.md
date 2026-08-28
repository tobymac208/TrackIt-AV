# AV Hardware Lifecycle Tracker

A single-user web application for tracking AV hardware across offices and conference rooms. Built with React (Vite) on the frontend and Node.js + Express + SQLite on the backend.

## Features

- **Offices** — Create and manage office locations
- **Conference Rooms** — Rooms belong to an office; click a room to view its hardware
- **Hardware Inventory** — Track manufacturer, model, description, replacement cost, MAC/IP, serial #, software version, credentials, importance level, end-of-support date, and upgrade recommendations
- **Room Assignment** — Assign hardware to rooms or keep items in unassigned inventory
- **Dashboard** — Summary stats, importance breakdown, and EOS alerts (within 90 days / past due)
- **Encrypted Passwords** — Device passwords are encrypted at rest (AES-256-GCM)

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later (includes npm)

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # On Windows: copy .env.example .env
npm run dev
```

The API runs at `http://localhost:3001`. The SQLite database is created automatically at `backend/data/avtracker.db`.

### 2. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies `/api` requests to the backend.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and adjust as needed:

| Variable | Description |
|----------|-------------|
| `PORT` | API server port (default: 3001) |
| `ENCRYPTION_KEY` | 64-character hex string (32 bytes) for password encryption |
| `DATABASE_PATH` | Path to SQLite database file |

Generate a new encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Important:** Do not change `ENCRYPTION_KEY` after storing passwords, or existing credentials cannot be decrypted.

## Backup

The database and `.env` file are **not** in Git. Use the backup script to copy them to a dated folder under `Documents\AVTracker-backups`.

From the project root in PowerShell:

```powershell
.\scripts\backup.ps1
```

Each run creates a timestamped folder, for example:

```
C:\Users\<you>\Documents\AVTracker-backups\2026-08-28_102045\
├── avtracker.db
└── .env
```

Optional parameters:

| Parameter | Description |
|-----------|-------------|
| `-BackupRoot "D:\Backups\AVTracker"` | Custom backup location |
| `-SkipEnv` | Database only (skip copying `backend/.env`) |

For the most reliable copy, stop the backend before backing up. If `sqlite3` is installed (`winget install SQLite.SQLite`), the script uses SQLite's online backup so you can back up while the app is running.

## Usage

1. **Create an office** — Go to Offices → Add Office
2. **Create a conference room** — Go to Rooms → Add Room (select the office)
3. **Add hardware** — Go to Hardware → Add Hardware, or open a room and click "Create Hardware for Room"
4. **Assign hardware** — From a room detail page, use "Add existing hardware" to assign unassigned items
5. **Monitor lifecycle** — Use the Dashboard to see EOS alerts and inventory summary
6. **Bulk import** — On the Hardware page, click **Import CSV** to upload multiple devices at once. Download the template for the expected column format.

## CSV Import Format

Required columns: `manufacturer`, `model` — **or** a single `product` column (e.g. `Cisco Touch 10` splits into manufacturer `Cisco` and model `Touch 10`).

Optional columns:

| Column | Description |
|--------|-------------|
| `product` | Webex-style product name; auto-split into manufacturer + model |
| `belongsto` | Webex conference room name (matched against existing rooms) |
| `description` | Device description |
| `estimated_replacement_cost` | Numeric cost (e.g. `2500.00`) |
| `mac_address` | MAC address |
| `ip_address` | IP address |
| `serial_number` | Serial number |
| `software_version` | Firmware/software version |
| `username` | Device login username |
| `password` | Device login password (encrypted at rest) |
| `importance_level` | `low`, `medium`, `high`, or `critical` (defaults to `medium`) |
| `end_of_support_date` | Date in `YYYY-MM-DD` format |
| `end_of_warranty_date` | Warranty expiration in `YYYY-MM-DD` format |
| `upgrade_recommendations` | Upgrade notes |
| `office` | Office name (use with `room` to disambiguate duplicate room names) |
| `room` | Room name (matched on its own, or with `office`) |

For room assignment, provide `belongsto` or `room` alone if the room name is unique. If multiple rooms share the same name across offices, add the `office` column to disambiguate. Rows with validation errors are skipped and reported after import.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/offices` | List / create offices |
| GET/PUT/DELETE | `/api/offices/:id` | Office CRUD |
| GET/POST | `/api/rooms` | List / create rooms (`?officeId=` filter) |
| GET/PUT/DELETE | `/api/rooms/:id` | Room CRUD |
| GET | `/api/rooms/:id/hardware` | Hardware in a room |
| GET/POST | `/api/hardware` | List / create hardware |
| POST | `/api/hardware/import` | Bulk import from CSV (`{ csv: "..." }`) |
| GET/PUT/DELETE | `/api/hardware/:id` | Hardware CRUD |
| PATCH | `/api/hardware/:id/assign` | Assign/unassign to room |

## Production Build

```bash
# Build frontend
cd frontend
npm run build

# Serve API (set NODE_ENV as needed)
cd ../backend
npm start
```

For production, serve the `frontend/dist` folder via a static file server or configure Express to serve it.

## Project Structure

```
AVTracker/
├── backend/          # Express API + SQLite
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   ├── crypto.js
│   │   └── routes/
│   └── data/         # SQLite database (gitignored)
├── scripts/
│   └── backup.ps1    # Database + .env backup script
├── frontend/         # React + Vite
│   └── src/
│       ├── pages/
│       ├── components/
│       └── api/
└── README.md
```
