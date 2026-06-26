# Testing Guide — SeatShare

## Philosophy

- Unit tests for business logic
- Integration tests for API endpoints
- Manual QA for mobile app (Expo Go)
- Admin dashboard tested via browser

## Running Tests

### Full Typecheck
```bash
pnpm run typecheck
```

### Lib Typecheck
```bash
pnpm run typecheck:libs
```

### Build (includes typecheck)
```bash
pnpm run build
```

## Manual Test Flows

### 1. Admin Login
1. Open admin dashboard
2. Enter `admin@seatshare.com` / `admin123`
3. Verify dashboard loads with metrics
4. Navigate to Live Map, verify driver pins appear

### 2. Mobile Demo Login
1. Open mobile app
2. Select "Find a Ride" or "Offer a Ride"
3. Enter `9999999999` → tap Send Code
4. Verify OTP auto-fills as `123456`
5. Tap Verify & Continue
6. Verify home screen loads

### 3. Mobile Seeded Demo
1. Open mobile app
2. Select role
3. Tap "Demo Login (Passenger/Driver)" button
4. Verify auto-login with `9000000001` or `9000000002`

### 4. Driver Location Update
1. Login as driver
2. Send location update
3. Check admin dashboard Live Map
4. Verify driver pin appears and moves

### 5. Staleness Sweep
1. Open admin Settings page
2. Change location staleness threshold
3. Wait for stale driver
4. Verify auto-offline log entry appears

### 6. CRUD Operations
1. Navigate to each admin page (Users, Drivers, Trips, etc.)
2. Create a new record
3. Edit the record
4. Delete the record
5. Verify no errors

### 7. API Validation
1. Send invalid data to any endpoint
2. Verify 400 error with Zod validation message

## Test Data

- Admin: `admin@seatshare.com` / `admin123`
- Demo passenger: `9999999999` / `123456`
- Demo passenger (seeded): `9000000001` / `123456`
- Demo driver (seeded): `9000000002` / `123456`

## Troubleshooting

- **API returns 400 on verify-otp**: Check server logs; ensure `send-otp` was called first
- **Admin dashboard blank**: Verify API server is running, check `localStorage` for JWT
- **Live map empty**: Check WebSocket connection, verify driver is online
- **Mobile app won't load**: Restart Expo workflow, check Metro bundler logs
- **Type errors after codegen**: Run `pnpm run typecheck:libs` to rebuild declarations

## Test Checklist (Before Release)

- [ ] Admin login works
- [ ] Mobile demo login works
- [ ] Mobile seeded demo works
- [ ] Driver location updates appear on admin map
- [ ] Staleness sweep auto-offlines stale drivers
- [ ] All CRUD pages work (create, edit, delete)
- [ ] Settings page updates and persists
- [ ] Admin logs show correct entries
- [ ] API validation rejects invalid data
- [ ] WebSocket reconnects after disconnect
- [ ] Mobile app works on iOS and Android (Expo Go)
- [ ] Typecheck passes across all packages
- [ ] Build succeeds for all artifacts
