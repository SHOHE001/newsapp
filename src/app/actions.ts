"use server";

import webpush from "web-push";
import { db } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function subscribeUser(sub: PushSubscriptionJSON) {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("Invalid push subscription");
  }

  await db
    .insert(pushSubscriptions)
    .values({
      endpoint: sub.endpoint,
      keysP256dh: sub.keys.p256dh,
      keysAuth: sub.keys.auth,
    })
    .onConflictDoNothing();

  return { success: true };
}

export async function unsubscribeUser(endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));

  return { success: true };
}

export async function sendNotification(
  message: string,
  url: string = "/"
) {
  const subs = await db.select().from(pushSubscriptions);

  const payload = JSON.stringify({
    title: "AI/IT NewsApp",
    body: message,
    url,
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keysP256dh,
            auth: sub.keysAuth,
          },
        },
        payload
      )
    )
  );

  const failed = results.filter((r) => r.status === "rejected");
  return { sent: subs.length, failed: failed.length };
}
