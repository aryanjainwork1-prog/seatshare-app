# Architecture — SeatShare

## High-Level Diagram

```
+-----------------------------------------------------------+
|                      Admin Dashboard                       |
|    React + Vite + Tailwind + shadcn/ui + TanStack Query   |
|                    Leaflet + WebSocket                     |
+-----------------------------------------------------------+
                            | API (REST + WS)
                            v
+-----------------------------------------------------------+
|                       API Server                           |
|          Express 5 + WebSocket (ws) + Zod               |
|                    Drizzle ORM + PG                       |
+-----------------------------------------------------------+
                            | DB
                            v
+-----------------------------------------------------------+
|                     PostgreSQL                             |
|         Users, Drivers, Trips, Bookings, Logs, etc.        |
+-----------------------------------------------------------+
                            | API (REST + WS)
                            v
+-----------------------------------------------------------+
|                       Mobile App                           |
|        Expo React Native + TanStack Query + WebSocket    |
+-----------------------------------------------------------+
```

## Monorepo Structure

```
artifacts/
  api-server/          Express API server
  admin-dashboard/     React admin dashboard
  mobile/              Expo React Native app
  mockup-sandbox/      Vite sandbox for canvas component previews
  api-spec/            OpenAPI spec + Orval codegen
lib/
  db/                  Drizzle ORM schema + seed
  api-client-react/    Generated React Query hooks from OpenAPI
  api-zod/             Generated Zod schemas from OpenAPI
scripts/               Shared utility scripts
```

## Key Design Decisions

1. **Contract-first API** — OpenAPI spec drives both server validation and client hooks
2. **Shared libraries** — `lib/db` and `lib/api-client-react` are built libs consumed by artifacts
3. **WebSocket for real-time** — Driver locations stream to admin dashboard via WebSocket
4. **Separate auth flows** — Admin uses email/password; mobile users use phone/OTP
5. **Dark-only admin dashboard** — Tailwind dark mode only for admin panel
6. **pnpm workspaces** — All packages use `catalog:` for shared dependency versions

## API Server Layers

- `routes/` — Express route handlers
- `middleware/` — Auth, error handling, logging
- `lib/` — Business logic (JWT, staleness sweep, sanitize)
- `ws.ts` — WebSocket handler for role-gated subscriptions

## Database

- PostgreSQL managed via Drizzle ORM
- Schema in `lib/db/src/schema/` (modular tables)
- Seed data in `lib/db/src/seed.ts`
- Migrations pushed via `pnpm --filter @workspace/db run push`

## Auth

- **Admin**: JWT (HS256, `SESSION_SECRET`), stored in localStorage
- **Mobile**: OTP flow (in-memory store, `123456` magic bypass for demo)
- **WebSocket**: `?token=` query param auth

## Real-Time

- WebSocket server shares Express HTTP server
- `subscribe_map` message triggers admin map feed
- `subscribe_driver` for driver-specific updates
- `heartbeat` every 30s for staleness detection
