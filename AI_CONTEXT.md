# AI Context — SeatShare

## Project Identity

- **Name**: SeatShare
- **Type**: Full-stack ride-sharing platform
- **Stack**: pnpm workspaces, Node.js 24, TypeScript 5.9, PostgreSQL, Drizzle ORM

## Key Files for AI

When working on this project, these files are essential:

| File | Purpose |
|------|---------|
| `replit.md` | Project overview, stack, key decisions |
| `ARCHITECTURE.md` | System architecture, monorepo structure |
| `DATABASE.md` | Schema reference, table definitions |
| `API.md` | Endpoint reference, WebSocket messages |
| `artifacts/api-spec/openapi.yaml` | API contract (source of truth) |
| `lib/db/src/schema.ts` | Drizzle ORM schema (source of truth) |
| `lib/db/src/seed.ts` | Seed data for testing |
| `pnpm-workspace.yaml` | Workspace package discovery |

## Working Conventions

1. **Contract-first**: Always update `openapi.yaml` before changing API code
2. **Codegen after spec changes**: `pnpm --filter @workspace/api-spec run codegen`
3. **Typecheck after lib changes**: `pnpm run typecheck:libs`
4. **No console.log in server**: Use `req.log` or `logger` singleton
5. **No root `pnpm dev`**: Use `restart_workflow <slug>` or per-package scripts
6. **Dark-only admin**: Never add light mode to admin dashboard
7. **Always use `catalog:`**: If dependency exists in `pnpm-workspace.yaml` catalog

## Common Commands

```bash
# Run services
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/admin-dashboard run dev
pnpm --filter @workspace/mobile run dev

# Typecheck
pnpm run typecheck
pnpm run typecheck:libs

# DB
pnpm --filter @workspace/db run push

# Codegen
pnpm --filter @workspace/api-spec run codegen

# Build
pnpm run build
```

## Architecture Patterns

- **API routes**: Express Router in `artifacts/api-server/src/routes/`
- **Auth**: JWT in localStorage (admin), bearer token in API hooks
- **WebSocket**: `ws` library, shared with Express HTTP server
- **DB**: Drizzle ORM, modular schema files in `lib/db/src/schema/`
- **Admin UI**: React + Vite, Tailwind dark mode, shadcn/ui, wouter
- **Mobile**: Expo SDK 54, React Native, TanStack Query
- **Validation**: Zod (v4) on server, generated schemas from OpenAPI

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — JWT signing secret
- `PORT` — assigned by workflow per artifact
- `BASE_PATH` — assigned by workflow per artifact

## Demo Credentials

- Admin: `admin@seatshare.com` / `admin123`
- Mobile: `9999999999` / `123456` (auto-bypass)
- Mobile (seeded): `9000000001` / `123456` (passenger), `9000000002` / `123456` (driver)

## Known Quirks

- `react-leaflet` v5 `useMapEvents` returns map instance directly
- `useListDriverProfiles` / `useListTrips` are list hooks (not `useGet...`)
- `colors.warning` does not exist in `useColors.ts`
- After OpenAPI changes, run codegen then typecheck:libs
- Mobile demo bypass calls real `send-otp` first to get valid session
- WebSocket auth uses `?token=` query param

## Testing Notes

- Manual QA via Expo Go for mobile
- Browser testing for admin dashboard
- API testing via curl or generated hooks
- Verify `typecheck` passes before committing

## Deployment

- Replit workflows handle dev servers
- Publishing via `suggest_deploy` tool
- Production DB uses same `DATABASE_URL` env var
- Admin dashboard and API server share same project

## AI Memory

- Use `.agents/memory/MEMORY.md` for durable lessons across sessions
- Never save secrets, credentials, or PII in memory
- Record non-obvious decisions, not implementation changelogs
- Topic files in `.agents/memory/` hold detailed context
