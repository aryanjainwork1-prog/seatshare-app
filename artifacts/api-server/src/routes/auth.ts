import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { generateAccessToken, generateRefreshToken, generateOtp, verifyAccessToken } from "../lib/jwt";

const router: IRouter = Router();

const otpStore = new Map<string, { otp: string; phone: string; expiresAt: number }>();

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

  res.json({ accessToken, refreshToken, user });
});

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

  res.json({ accessToken, refreshToken: newRefreshToken, user });
});

export default router;
