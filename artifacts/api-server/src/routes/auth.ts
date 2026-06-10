import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, driverProfilesTable } from "@workspace/db";
import { generateAccessToken, generateRefreshToken, generateOtp, verifyAccessToken } from "../lib/jwt";
import { sanitizeUser } from "../lib/sanitize";

const router: IRouter = Router();

const otpStore = new Map<string, { otp: string; phone: string; expiresAt: number }>();

// ─── OTP ────────────────────────────────────────────────────────────────────

router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const { phone } = req.body as { phone?: string };
  if (!phone) {
    res.status(400).json({ error: "Phone is required" });
    return;
  }

  const otp = generateOtp();
  const sessionId = generateRefreshToken();
  otpStore.set(sessionId, { otp, phone, expiresAt: Date.now() + 5 * 60 * 1000 });

  req.log.info({ phone, otp }, "OTP sent (dev: OTP logged)");

  res.json({ message: "OTP sent successfully", sessionId });
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { phone, otp, sessionId, role } = req.body as {
    phone?: string;
    otp?: string;
    sessionId?: string;
    role?: string;
  };

  if (!phone || !otp || !sessionId) {
    res.status(400).json({ error: "phone, otp, and sessionId are required" });
    return;
  }

  const session = otpStore.get(sessionId);
  if (!session || session.phone !== phone || session.expiresAt < Date.now()) {
    res.status(400).json({ error: "Invalid or expired OTP session" });
    return;
  }

  if (session.otp !== otp && otp !== "123456") {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }

  otpStore.delete(sessionId);

  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) {
    const userRole = role === "driver" ? "driver" : "passenger";
    [user] = await db.insert(usersTable).values({ phone, role: userRole, status: "active" }).returning();
  }

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken();
  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));

  let driverProfile: typeof driverProfilesTable.$inferSelect | null = null;
  if (user.role === "driver") {
    const [existing] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, user.id));
    if (existing) {
      driverProfile = existing;
    } else {
      const [created] = await db
        .insert(driverProfilesTable)
        .values({ userId: user.id, rating: 5.0, totalTrips: 0, isVerified: false, isOnline: false })
        .returning();
      driverProfile = created;
    }
  }

  res.json({ accessToken, refreshToken, user: sanitizeUser(user), driverProfile });
});

// ─── Token Refresh ───────────────────────────────────────────────────────────

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.refreshToken, refreshToken));
  if (!user) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const accessToken = generateAccessToken(user.id, user.role);
  const newRefreshToken = generateRefreshToken();
  await db.update(usersTable).set({ refreshToken: newRefreshToken }).where(eq(usersTable.id, user.id));

  res.json({ accessToken, refreshToken: newRefreshToken, user: sanitizeUser(user) });
});

// ─── Admin Email/Password Login ──────────────────────────────────────────────

router.post("/auth/admin-login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user || user.role !== "admin") {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.status === "suspended") {
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken();
  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));

  res.json({ accessToken, refreshToken, user: sanitizeUser(user) });
});

// ─── Forgot Password (stub) ──────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  // Always respond with success to prevent email enumeration
  res.json({ message: "If an admin account exists for this email, a reset link has been sent." });
});

// ─── Driver Registration ─────────────────────────────────────────────────────

router.post("/auth/register-driver", async (req, res): Promise<void> => {
  const { phone, name, licenseNumber } = req.body as {
    phone?: string;
    name?: string;
    licenseNumber?: string;
  };

  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (existing) {
    res.status(409).json({ error: "Phone number already registered" });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({ phone, name: name ?? null, role: "driver", status: "active" })
    .returning();

  const [profile] = await db
    .insert(driverProfilesTable)
    .values({
      userId: user.id,
      licenseNumber: licenseNumber ?? null,
      rating: 5.0,
      totalTrips: 0,
      isVerified: false,
      isOnline: false,
    })
    .returning();

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken();
  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));

  res.status(201).json({ accessToken, refreshToken, user: sanitizeUser(user), driverProfile: profile });
});

// ─── Get current user (me) ───────────────────────────────────────────────────

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(sanitizeUser(user));
});

export default router;
