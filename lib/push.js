import webpush from "web-push";
import { getSubscriptions, deleteSubscription } from "./db";

let configured = false;
function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:abimbolaobafisayo@gmail.com",
    publicKey,
    privateKey
  );
  configured = true;
}

export async function broadcastPush(payload) {
  configure();
  const subs = await getSubscriptions();
  const results = await Promise.allSettled(
    subs.map((row) =>
      webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload)
      )
    )
  );
  await Promise.all(
    results.map((r, i) => {
      if (r.status === "rejected" && (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)) {
        return deleteSubscription(subs[i].endpoint);
      }
      return null;
    })
  );
  return results;
}
