# YouTube Together — Private Synchronized Listening Room

A production-quality full-stack web application that allows two people to listen to YouTube videos together in a private room. If one person plays, pauses, seeks, or changes the queue, the other person's player updates in real-time, correcting drift dynamically.

## Repository Structure

```text
youtube-together/
│
├── apps/
│   ├── web/           # React + Vite + TypeScript (Frontend)
│   └── api/           # NestJS + Prisma + PostgreSQL (Backend)
│
├── packages/
│   └── shared/        # Shared TypeScript interfaces & Socket.IO event contracts
│
├── prisma/            # DB Schema (inside apps/api/prisma)
├── package.json       # Monorepo Workspace configuration
└── README.md
```

---

## Key Features

1. **Authoritative Server Playback**: The server tracks the canonical seek position, playback state, and timestamp. Expected positions are computed from the offset to ensure millisecond-level precision without constant seeking.
2. **Dynamic Drift Correction**:
   - **Difference < 0.25s**: Do nothing (prevents jitter).
   - **0.25s < Difference < 1s**: Gradually speed up ($1.25\times$) or slow down ($0.75\times$) using the YouTube IFrame player speed API to align smoothly.
   - **Difference >= 1s**: Execute a hard seek to catch up.
3. **Smart debounced Search & Cache**: 450ms debounced search on the frontend with server caching. Includes a mock songs provider fallback if no `YOUTUBE_API_KEY` is present.
4. **Presence Tracking**: In-memory connection status mapping. Capped at 2 active connections per room. Online status is restored automatically upon reconnection.

---

## Getting Started

### 1. Prerequisites
- **Node.js** v18+ and **npm**
- **PostgreSQL** running locally on port 5432 (or customizable via `.env`)

### 2. Install Dependencies
Run from the root of the workspace:
```bash
npm install
```

### 3. Database Migration
Apply the Prisma migration to set up database tables:
```bash
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name init
```

### 4. Running the Dev Servers
Run the NestJS backend and Vite frontend dev servers:
```bash
# In Terminal 1: Start backend
node apps/api/dist/main.js

# In Terminal 2: Start frontend
npm run dev --workspace=@youtube-together/web
```
- Open **Frontend**: `http://localhost:5173`
- Open **Backend API**: `http://localhost:3000`

---

## Environment Variables (`.env`)

```env
# API Server Configuration
PORT=3000
DATABASE_URL=postgresql://postgres:Sh%40shiv%235@localhost:5432/youtube_together?schema=public

# YouTube Data API Key (Optional; fallbacks to mock songs if empty)
YOUTUBE_API_KEY=

# Frontend Configuration
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```
