import { logger } from "./logger";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export async function sendPushNotification(message: ExpoPushMessage): Promise<void> {
  if (!message.to || !message.to.startsWith("ExponentPushToken[")) {
    return;
  }
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...message, sound: "default" }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn({ token: message.to, status: res.status, body: text }, "Push notification failed");
    }
  } catch (err) {
    logger.warn({ err, token: message.to }, "Push notification error");
  }
}

export async function sendPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  const valid = messages.filter((m) => m.to?.startsWith("ExponentPushToken["));
  if (valid.length === 0) return;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(valid.map((m) => ({ ...m, sound: "default" }))),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn({ count: valid.length, status: res.status, body: text }, "Batch push notification failed");
    }
  } catch (err) {
    logger.warn({ err, count: valid.length }, "Batch push notification error");
  }
}
