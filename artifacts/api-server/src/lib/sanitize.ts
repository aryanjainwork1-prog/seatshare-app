import type { User } from "@workspace/db";

export function sanitizeUser(user: User) {
  const { passwordHash: _ph, refreshToken: _rt, ...safe } = user;
  return safe;
}
