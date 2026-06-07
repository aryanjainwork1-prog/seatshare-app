import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.patch("/me/push-token", async (req, res): Promise<void> => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token is required" });
    return;
  }

  await db.update(usersTable).set({ expoPushToken: token }).where(eq(usersTable.id, userId));
  res.json({ message: "Push token registered" });
});

export default router;
