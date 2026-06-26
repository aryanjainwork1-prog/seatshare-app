# Changelog — SeatShare

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Admin dashboard Settings page for platform configuration
- `platform_settings` table for key-value settings
- `GET /api/settings` and `PUT /api/settings` endpoints
- Location staleness threshold configurable from admin dashboard
- Admin log action filter with amber badge for auto_offline

### Changed
- Staleness sweep now reads threshold from `platform_settings` table
- Demo bypass for mobile login now calls real `send-otp` to get valid session

### Fixed
- Demo login returning 400 due to fake sessionId not in server otpStore

## [2024-06-26] — Staleness Sweep & Admin Logs

### Added
- Staleness sweep job that auto-offlines drivers with stale locations
- Admin log entries for auto_offline with driver name and last location
- `admin_logs` table with `action` enum and nullable `adminId`

### Fixed
- Admin log action filter showing correct amber badge

## [2024-06-25] — Live Map & Real-Time

### Added
- WebSocket server for real-time driver location streaming
- Admin Live Map page with Leaflet + CartoDB dark tiles
- Online drivers panel and active trips panel
- Driver heartbeat endpoint (`POST /api/driver-profiles/:id/heartbeat`)
- Location update endpoint (`POST /api/driver-profiles/:id/location`)

## [2024-06-24] — Admin Dashboard Pages

### Added
- Admin dashboard with dark-only UI
- Dashboard overview page with metrics and charts
- Users, Drivers, Trips, Bookings, Payments, Support pages
- Admin logs page with action filtering
- Email/password admin login with JWT

### Fixed
- Leaflet CSS import in live map page
- `useListDriverProfiles` / `useListTrips` hook naming

## [2024-06-23] — Mobile App & Auth

### Added
- Expo React Native mobile app
- Phone + OTP authentication flow
- Role selection (passenger / driver)
- Demo mode toggle in profile
- Demo login with seeded accounts (`9000000001`, `9000000002`)
- Demo bypass for `9999999999` / `123456`

### Fixed
- Mobile keyboard avoid view on iOS
- Safe area insets for top and bottom bars

## [2024-06-22] — API Foundation

### Added
- Express API server with OpenAPI contract
- PostgreSQL database with Drizzle ORM
- Zod validation on all endpoints
- Generated React Query hooks (`lib/api-client-react`)
- Generated Zod schemas (`lib/api-zod`)
- Seed data with admin user and demo accounts

### Fixed
- `setAuthTokenGetter` wiring in `AuthProvider`
- Bearer token injection in generated API hooks

## [2024-06-21] — Project Setup

### Added
- pnpm monorepo with workspaces
- TypeScript 5.9 with strict mode
- Tailwind CSS for admin dashboard
- shadcn/ui component library
- Recharts for charts
- wouter for routing
- TanStack Query for data fetching

### Fixed
- Initial workspace configuration
- TypeScript project references for composite libs
