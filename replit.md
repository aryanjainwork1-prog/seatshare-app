# SeatShare Admin Dashboard

A full-stack ride-sharing platform admin control panel with real-time driver tracking, trip management, user administration, and live analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + WebSocket (`ws`)
- DB: PostgreSQL + Drizzle ORM
- Admin UI: React + Vite, Tailwind (dark-only), shadcn/ui, wouter, TanStack Query, Recharts
- Auth: JWT (HS256, SESSION_SECRET), bcryptjs, `lib/api-client-react` bearer token via `setAuthTokenGetter`
- Map: Leaflet + react-leaflet, CartoDB dark-matter tiles, WebSocket live driver tracking
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema.ts` — Drizzle ORM schema (source of truth for DB)
- `lib/db/src/seed.ts` — Versioned seed (admin: admin@seatshare.com / admin123)
- `artifacts/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/` — Generated React Query hooks + custom-fetch with bearer token support
- `artifacts/admin-dashboard/src/context/AuthContext.tsx` — Auth context (JWT stored in localStorage)
- `artifacts/admin-dashboard/src/pages/live-map.tsx` — Live map (Leaflet + WebSocket)
- `artifacts/api-server/src/ws.ts` — WebSocket handler with role-gated map subscriptions

## Architecture decisions

- Admin login uses email+password (JWT), while passenger/driver login uses phone+OTP
- `setAuthTokenGetter` in `lib/api-client-react` wires the localStorage token into all generated API hooks automatically — must be called from `AuthProvider` on mount
- WebSocket auth uses `?token=` query param; subscribe_map message triggers admin map feed
- Shell layout has `variant="fullscreen"` for the live map page to fill the viewport without padding
- All admin routes are protected by `RequireAuth` component using wouter `Redirect`

## Product

- **Auth**: Email/password admin login with JWT, route guards, persist session
- **Dashboard**: Live platform metrics (users, drivers, trips, revenue, bookings, open tickets) + charts
- **Live Map**: Real-time driver location tracking via WebSocket, online drivers panel, active trips panel
- **Users / Drivers / Trips / Bookings / Payments / Support / Logs**: Full CRUD management pages

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing the OpenAPI spec, run `pnpm --filter @workspace/api-spec run codegen` and then `pnpm run typecheck:libs`
- Leaflet CSS must be imported directly in the page component (`import "leaflet/dist/leaflet.css"`)
- `react-leaflet` v5 `useMapEvents` returns the map instance directly — use it to get bounds on init
- `useListDriverProfiles` / `useListTrips` are the list hooks (not `useGetDriverProfiles`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
