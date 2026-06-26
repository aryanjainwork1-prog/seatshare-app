# Roadmap — SeatShare

## ✅ Completed

### Core Infrastructure
- [x] pnpm monorepo with workspaces
- [x] PostgreSQL + Drizzle ORM setup
- [x] OpenAPI contract + Orval codegen
- [x] Express API server with JWT auth
- [x] Admin dashboard (React + Vite + Tailwind)
- [x] Mobile app (Expo React Native)
- [x] WebSocket real-time driver tracking

### Authentication
- [x] Admin email/password login
- [x] Mobile phone + OTP login
- [x] JWT refresh token flow
- [x] WebSocket auth via query param
- [x] Demo bypass login (9999999999 / 123456)

### Admin Dashboard
- [x] Dashboard overview with metrics
- [x] Live map with driver tracking
- [x] Users / Drivers / Trips / Bookings / Payments / Support pages
- [x] Admin logs with action filtering
- [x] Platform settings (staleness threshold)
- [x] Dark-only UI

### Mobile App
- [x] Phone + OTP flow
- [x] Role selection (passenger / driver)
- [x] Demo mode
- [x] Profile & settings

### API
- [x] Full CRUD endpoints
- [x] Zod validation
- [x] Real-time WebSocket
- [x] Staleness sweep with auto-offline
- [x] Admin log generation

## 🔄 In Progress

- [ ] Task #79: Admin-adjustable location staleness threshold
- [ ] Task #80: Driver app — publish trip flow
- [ ] Task #81: Passenger app — book trip flow

## 🗓️ Planned (Short-Term)

- [ ] Push notifications (Expo notifications)
- [ ] In-app chat (passenger ↔ driver)
- [ ] Payment integration (Stripe / Whop)
- [ ] Rating system (passenger/driver mutual ratings)
- [ ] Route visualization (Polyline on map)
- [ ] Trip search & filters (date, price, seats)
- [ ] Driver earnings dashboard
- [ ] Passenger booking history

## 🗓️ Planned (Mid-Term)

- [ ] Google / Apple OAuth for mobile
- [ ] Multi-language support
- [ ] Dark mode toggle (mobile)
- [ ] Analytics dashboard (admin)
- [ ] Export reports (CSV, PDF)
- [ ] KYC verification for drivers
- [ ] Insurance integration
- [ ] Admin notifications (Slack / email)

## 🗓️ Planned (Long-Term)

- [ ] Native app builds (EAS build)
- [ ] App Store / Play Store submission
- [ ] Advanced route optimization
- [ ] AI-based demand prediction
- [ ] Dynamic pricing
- [ ] Fleet management for corporate accounts
- [ ] API rate limiting
- [ ] CDN for static assets

## 📌 Backlog

- [ ] Unit tests for API endpoints
- [ ] E2E tests for mobile flows
- [ ] Admin dashboard E2E tests
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] Documentation (API docs, deployment guide)
- [ ] CI/CD pipeline
- [ ] Docker containers
- [ ] Kubernetes deployment
- [ ] Monitoring (Datadog, Sentry)
- [ ] Load testing
- [ ] GDPR compliance
