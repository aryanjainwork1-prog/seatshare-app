# Product Requirements Document (PRD) — SeatShare

## 1. Overview

SeatShare is a ride-sharing platform that connects passengers with drivers for shared trips. The platform is a full-stack application consisting of:
- A mobile app (Expo React Native) for passengers and drivers
- An admin dashboard (React + Vite) for platform management
- A backend API (Express + WebSocket) for data and real-time services

## 2. Goals

- Enable passengers to find and book rides in real-time
- Allow drivers to offer rides and manage their routes
- Provide real-time driver tracking and live trip status
- Support an admin dashboard with analytics, user management, and live map monitoring
- Handle payments, bookings, and support tickets

## 3. Key Features

### Mobile App
- Phone + OTP authentication for passengers and drivers
- Role-based flows (passenger vs. driver)
- Real-time driver location tracking
- Trip booking and management
- Profile and settings
- Demo mode for quick testing

### Admin Dashboard
- Email + password admin login (JWT)
- Real-time platform metrics (users, drivers, trips, revenue)
- Live map with driver tracking via WebSocket
- Full CRUD management for users, drivers, trips, bookings, payments, support tickets
- Admin logs with action tracking
- Platform settings (location staleness threshold, etc.)

### API
- RESTful API with OpenAPI contract
- WebSocket for real-time driver location streaming
- JWT authentication (admin, passenger, driver)
- PostgreSQL database with Drizzle ORM
- Zod validation on all endpoints

## 4. Non-Goals

- Native app distribution (App Store / Play Store)
- In-app payments (Stripe/Shopify not integrated)
- Multi-language support
- Advanced driver routing / optimization

## 5. Success Criteria

- Passenger can book a ride end-to-end
- Driver can publish a route and manage trips
- Admin can view real-time metrics and live map
- All demo login flows work without manual OTP
- API endpoints are type-safe and validated

## 6. Target Users

- **Passengers** — Commuters, students, travelers seeking shared rides
- **Drivers** — Private vehicle owners, ride-share partners
- **Admins** — Platform operators managing the ecosystem

## 7. Release Notes

See [CHANGELOG.md](./CHANGELOG.md)
