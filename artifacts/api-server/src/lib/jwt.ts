import { createHmac, randomBytes } from "crypto";

const SECRET = process.env.SESSION_SECRET ?? "seatshare-dev-secret-key";

function base64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function sign(payload: object): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verify(token: string): Record<string, unknown> | null {
  try {
    const [header, body, sig] = token.split(".");
    const expected = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateAccessToken(userId: number, role: string): string {
  return sign({ sub: userId, role, exp: Math.floor(Date.now() / 1000) + 3600 });
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function verifyAccessToken(token: string): { sub: number; role: string } | null {
  const payload = verify(token);
  if (!payload) return null;
  return { sub: Number(payload.sub), role: String(payload.role) };
}

export { sign, verify };
