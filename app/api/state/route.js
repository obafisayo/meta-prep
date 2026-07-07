import { getAllDays, upsertDay, wipeDays } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const days = await getAllDays();
    return Response.json({ days });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.wipe) {
      await wipeDays();
      return Response.json({ ok: true });
    }
    const { dayKey, done, note } = body;
    if (!dayKey) return Response.json({ error: "dayKey required" }, { status: 400 });
    await upsertDay(dayKey, done || {}, note || "");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
