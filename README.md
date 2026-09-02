# AV Hardware Lifecycle Tracker

A single-user web application for tracking AV hardware across offices and conference rooms. Built with React (Vite) on the frontend and Node.js + Express on the backend. Local development uses SQLite; Cloud Run uses Cloud SQL (Postgres).

## Features

- **Offices** — Create and manage office locations
- **Conference Rooms** — Rooms belong to an office; click a room to view its hardware
- **Hardware Inventory** — Track manufacturer, model, description, replacement cost, MAC/IP, serial #, software version, credentials, importance level, end-of-support date, and upgrade recommendations
- **Room Assignment** — Assign hardware to rooms or keep items in unassigned inventory
- **Dashboard** — Summary stats, importance breakdown, and EOS alerts (within 90 days / past due)
- **Encrypted Passwords** — Device passwords are encrypted at rest (AES-256-GCM)

## Prerequisites

- [Node.js](https://nodejs.org/) 22 or later (includes npm)

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
| `PORT` | API server port (default: 3001, Cloud Run sets `8080`) |
| `ENCRYPTION_KEY` | 64-character hex string (32 bytes) for password encryption |
| `DATABASE_PATH` | Local SQLite file (used when no Postgres settings are present) |
| `DATABASE_URL` | Optional Postgres URL (takes precedence) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASS` / `DB_NAME` | Postgres connection for Cloud SQL Auth Proxy or a local server |
| `INSTANCE_CONNECTION_NAME` | Cloud Run unix socket: `PROJECT:REGION:INSTANCE` |

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
cd frontend
npm run build
cd ../backend
npm start
```

When `frontend/dist` exists, Express serves the UI and `/api` from the same process.

## Cloud Run + Cloud SQL

The repo includes a `Dockerfile` and `cloudbuild.yaml`. The container builds the frontend and runs the API, which serves the UI and talks to Cloud SQL.

### One-time GCP setup

```bash
gcloud config set project YOUR_PROJECT
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com

gcloud artifacts repositories create avtracker --repository-format=docker --location=us-central1

gcloud sql instances create avtracker-db --database-version=POSTGRES_16 --tier=db-f1-micro --region=us-central1
gcloud sql databases create avtracker --instance=avtracker-db
gcloud sql users set-password postgres --instance=avtracker-db --password=YOUR_DB_PASSWORD

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# store that output:
echo -n "YOUR_HEX_KEY" | gcloud secrets create encryption-key --data-file=-
echo -n "YOUR_DB_PASSWORD" | gcloud secrets create db-pass --data-file=-
```

Grant the Cloud Run service account `roles/cloudsql.client` and Secret Manager accessor.

### Copy local SQLite data into Cloud SQL

Run the Cloud SQL Auth Proxy, then from `backend/`:

```bash
# cloud-sql-proxy YOUR_PROJECT:us-central1:avtracker-db
set DB_HOST=127.0.0.1
set DB_USER=postgres
set DB_PASS=YOUR_DB_PASSWORD
set DB_NAME=avtracker
node src/migrateFromSqlite.js
```

Use the same `ENCRYPTION_KEY` as the local `.env` so existing device passwords still decrypt.

### Deploy

Edit `cloudbuild.yaml` substitutions (`_CLOUDSQL`, and project defaults), then:

```bash
gcloud builds submit --config cloudbuild.yaml --substitutions=_CLOUDSQL=YOUR_PROJECT:us-central1:avtracker-db
```

This app has no login. Put IAP (or another gate) in front before sharing the URL.

## Project Structure

```
AVTracker/
├── Dockerfile        # Cloud Run image (UI + API)
├── cloudbuild.yaml
├── backend/          # Express API (SQLite locally, Cloud SQL in prod)
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   ├── crypto.js
│   │   ├── migrateFromSqlite.js
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
