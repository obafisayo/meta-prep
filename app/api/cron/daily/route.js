import { atMidnight, keyOf, dayIndex, fmt, tasksFor, TOTAL_DAYS } from "@/lib/schedule";
import { getAllDays } from "@/lib/db";
import { sendDigestEmail, renderDigestHtml } from "@/lib/email";
import { broadcastPush } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = atMidnight(new Date());
  const idx = dayIndex(today);
  if (idx < 0 || idx >= TOTAL_DAYS) {
    return Response.json({ skipped: "outside program window" });
  }

  const plan = tasksFor(today);
  const dayKey = keyOf(today);
  const days = await getAllDays();
  const dayData = days[dayKey] || { done: {}, note: "" };
  const doneCount = plan.tasks.filter((t) => dayData.done[t.id]).length;

  let streak = 0;
  let i = idx;
  const fracOf = (n) => {
    const d = new Date(today.getTime() - (idx - n) * 86400000);
    const p = tasksFor(d);
    const dd = days[keyOf(d)];
    if (!dd) return 0;
    return p.tasks.filter((t) => dd.done[t.id]).length / p.tasks.length;
  };
  if (fracOf(i) === 0) i--;
  while (i >= 0 && fracOf(i) > 0) { streak++; i--; }

  let sum = 0;
  for (let n = 0; n <= idx; n++) sum += fracOf(n);
  const overall = sum / (idx + 1);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://meta-prep.vercel.app";

  const results = { email: null, push: null };

  try {
    if (process.env.RESEND_API_KEY && process.env.DIGEST_EMAIL_TO) {
      await sendDigestEmail({
        to: process.env.DIGEST_EMAIL_TO,
        subject: doneCount === plan.tasks.length
          ? `✅ Day ${idx + 1}/${TOTAL_DAYS} already done — nice`
          : `Day ${idx + 1}/${TOTAL_DAYS} — ${plan.tasks.length - doneCount} task(s) left`,
        html: renderDigestHtml({
          dayLabel: fmt(today),
          dayNum: idx + 1,
          totalDays: TOTAL_DAYS,
          weekTheme: plan.week.theme,
          tasks: plan.tasks,
          doneMap: dayData.done,
          streak,
          overall,
          appUrl,
        }),
      });
      results.email = "sent";
    }
  } catch (err) {
    results.email = `error: ${err.message}`;
  }

  try {
    if (process.env.VAPID_PRIVATE_KEY) {
      await broadcastPush({
        title: `Day ${idx + 1}/${TOTAL_DAYS} — ${plan.week.theme}`,
        body: doneCount === plan.tasks.length ? "Already logged today. 🔥" : "Today's grind is waiting.",
        url: appUrl,
      });
      results.push = "sent";
    }
  } catch (err) {
    results.push = `error: ${err.message}`;
  }

  return Response.json({ dayKey, streak, overall, results });
}
