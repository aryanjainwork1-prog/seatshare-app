# API Reference — SeatShare

## Base URL

- Development: `/api` (proxied via Replit shared proxy)
- WebSocket: `/ws` (same host)

## Authentication

### Admin
- `POST /api/admin/login` — email + password → JWT tokens
- `POST /api/admin/refresh` — refresh token → new access token

### Mobile
- `POST /api/auth/send-otp` — phone → OTP session
- `POST /api/auth/verify-otp` — phone + OTP + sessionId → JWT tokens
- `POST /api/auth/refresh` — refresh token → new access token

### WebSocket
- Connect with `?token=<jwt>` query param
- Admin role required for `subscribe_map` feed

## Endpoints

### Admin
- `POST /api/admin/login` — body: `{ email, password }`
- `POST /api/admin/refresh` — body: `{ refreshToken }`

### Auth
- `POST /api/auth/send-otp` — body: `{ phone }`
- `POST /api/auth/verify-otp` — body: `{ phone, otp, sessionId, role }`
- `POST /api/auth/refresh` — body: `{ refreshToken }`

### Users
- `GET /api/users` — list all users
- `GET /api/users/:id` — get user by ID
- `PUT /api/users/:id` — update user
- `DELETE /api/users/:id` — delete user

### Driver Profiles
- `GET /api/driver-profiles` — list all driver profiles
- `GET /api/driver-profiles/:id` — get driver profile
- `PUT /api/driver-profiles/:id` — update driver profile
- `POST /api/driver-profiles/:id/location` — update driver location
- `POST /api/driver-profiles/:id/heartbeat` — driver heartbeat

### Trips
- `GET /api/trips` — list all trips
- `GET /api/trips/:id` — get trip
- `POST /api/trips` — create trip
- `PUT /api/trips/:id` — update trip
- `DELETE /api/trips/:id` — delete trip

### Bookings
- `GET /api/bookings` — list all bookings
- `GET /api/bookings/:id` — get booking
- `POST /api/bookings` — create booking
- `PUT /api/bookings/:id` — update booking
- `DELETE /api/bookings/:id` — delete booking

### Payments
- `GET /api/payments` — list all payments
- `GET /api/payments/:id` — get payment
- `PUT /api/payments/:id` — update payment

### Support Tickets
- `GET /api/support-tickets` — list all tickets
- `GET /api/support-tickets/:id` — get ticket
- `POST /api/support-tickets` — create ticket
- `PUT /api/support-tickets/:id` — update ticket
- `DELETE /api/support-tickets/:id` — delete ticket

### Admin Logs
- `GET /api/admin-logs` — list all admin logs
- `GET /api/admin-logs/action/:action` — filter by action

### Settings
- `GET /api/settings` — get platform settings
- `PUT /api/settings` — update platform settings

### WebSocket Messages

#### Client → Server
- `subscribe_map` — subscribe to admin map feed
- `subscribe_driver` — subscribe to driver updates
- `heartbeat` — send heartbeat
- `update_location` — send driver location

#### Server → Client
- `driver_locations` — array of driver locations
- `active_trips` — array of active trips
- `driver_update` — single driver update
- `error` — error message

## OpenAPI Spec

Full spec: `artifacts/api-spec/openapi.yaml`

Generated code:
- `lib/api-client-react/` — React Query hooks
- `lib/api-zod/` — Zod schemas

Generate command:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Status Codes

- `200` — OK
- `201` — Created
- `400` — Bad Request (validation error)
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Not Found
- `500` — Internal Server Error

## Demo Credentials

- **Admin**: `admin@seatshare.com` / `admin123`
- **Mobile**: `9999999999` / `123456` (auto-bypass)
- **Mobile (seeded)**: `9000000001` / `123456` (passenger) or `9000000002` / `123456` (driver)
