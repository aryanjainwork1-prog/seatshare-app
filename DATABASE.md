# Database Schema — SeatShare

## Overview

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Schema location**: `lib/db/src/schema/`
- **Seed**: `lib/db/src/seed.ts`
- **Push**: `pnpm --filter @workspace/db run push`

## Tables

### `users`
Platform users (passengers, drivers, admins)
- `id` (serial, PK)
- `email` (varchar, nullable)
- `phone` (varchar, nullable)
- `password` (varchar, nullable)
- `role` (enum: passenger, driver, admin)
- `status` (enum: active, inactive, suspended)
- `refreshToken` (varchar, nullable)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `driver_profiles`
Extended driver info
- `id` (serial, PK)
- `userId` (integer, FK -> users)
- `name` (varchar)
- `licenseNumber` (varchar)
- `vehicleModel` (varchar)
- `vehiclePlate` (varchar)
- `isOnline` (boolean)
- `lastLocation` (json, nullable)
- `lastLocationAt` (timestamp, nullable)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `trips`
Ride trips
- `id` (serial, PK)
- `driverId` (integer, FK -> users)
- `origin` (json)
- `destination` (json)
- `departureTime` (timestamp)
- `availableSeats` (integer)
- `price` (decimal)
- `status` (enum: scheduled, active, completed, cancelled)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `bookings`
Passenger trip bookings
- `id` (serial, PK)
- `tripId` (integer, FK -> trips)
- `passengerId` (integer, FK -> users)
- `seats` (integer)
- `status` (enum: pending, confirmed, cancelled)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `payments`
- `id` (serial, PK)
- `bookingId` (integer, FK -> bookings)
- `amount` (decimal)
- `status` (enum: pending, completed, failed)
- `createdAt` (timestamp)

### `support_tickets`
- `id` (serial, PK)
- `userId` (integer, FK -> users)
- `subject` (varchar)
- `message` (text)
- `status` (enum: open, in_progress, resolved)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `platform_settings`
- `id` (serial, PK)
- `key` (varchar, unique)
- `value` (text)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `admin_logs`
- `id` (serial, PK)
- `action` (enum: login, logout, user_update, driver_update, trip_update, booking_update, payment_update, support_update, auto_offline)
- `adminId` (integer, FK -> users, nullable)
- `targetId` (integer, nullable)
- `details` (json, nullable)
- `createdAt` (timestamp)

## Relationships

- `users` (1) → `driver_profiles` (1) — one driver profile per user
- `users` (1) → `trips` (N) — one driver creates many trips
- `trips` (1) → `bookings` (N) — one trip has many bookings
- `users` (1) → `bookings` (N) — one passenger makes many bookings
- `bookings` (1) → `payments` (1) — one payment per booking
- `users` (1) → `support_tickets` (N) — one user opens many tickets

## Indexes

- `users.phone` (unique)
- `users.email` (unique, where not null)
- `driver_profiles.userId` (unique)
- `platform_settings.key` (unique)
