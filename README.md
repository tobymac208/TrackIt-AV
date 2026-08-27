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

## Usage

1. **Create an office** — Go to Offices → Add Office
2. **Create a conference room** — Go to Rooms → Add Room (select the office)
3. **Add hardware** — Go to Hardware → Add Hardware, or open a room and click "Create Hardware for Room"
4. **Assign hardware** — From a room detail page, use "Add existing hardware" to assign unassigned items
5. **Monitor lifecycle** — Use the Dashboard to see EOS alerts and inventory summary

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/offices` | List / create offices |
| GET/PUT/DELETE | `/api/offices/:id` | Office CRUD |
| GET/POST | `/api/rooms` | List / create rooms (`?officeId=` filter) |
| GET/PUT/DELETE | `/api/rooms/:id` | Room CRUD |
| GET | `/api/rooms/:id/hardware` | Hardware in a room |
| GET/POST | `/api/hardware` | List / create hardware |
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
├── frontend/         # React + Vite
│   └── src/
│       ├── pages/
│       ├── components/
│       └── api/
└── README.md
```
