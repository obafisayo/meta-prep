import { saveSubscription, deleteSubscription } from "@/lib/db";

export async function POST(request) {
  try {
    const sub = await request.json();
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return Response.json({ error: "invalid subscription" }, { status: 400 });
    }
    await saveSubscription(sub);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) return Response.json({ error: "endpoint required" }, { status: 400 });
    await deleteSubscription(endpoint);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
