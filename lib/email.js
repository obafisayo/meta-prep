import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendDigestEmail({ to, subject, html }) {
  if (!resend) throw new Error("RESEND_API_KEY not configured");
  const from = process.env.RESEND_FROM || "Meta PE Prep <onboarding@resend.dev>";
  return resend.emails.send({ from, to, subject, html });
}

export function renderDigestHtml({ dayLabel, dayNum, totalDays, weekTheme, tasks, doneMap, streak, overall, appUrl }) {
  const rows = tasks
    .map((t) => {
      const done = !!doneMap[t.id];
      return `<tr>
        <td style="padding:6px 10px;color:${done ? "#B8860B" : "#333"};text-decoration:${done ? "line-through" : "none"}">
          ${done ? "[x]" : "[ ]"} ${escapeHtml(t.label)}
        </td>
      </tr>`;
    })
    .join("");

  return `
    <div style="font-family:ui-monospace,Menlo,Consolas,monospace;background:#141008;color:#A08A62;padding:24px">
      <div style="max-width:520px;margin:0 auto">
        <div style="color:#6B5A3E;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">
          meta pe prep · day ${dayNum} of ${totalDays}
        </div>
        <div style="color:#FFD08A;font-size:18px;margin-bottom:4px">${escapeHtml(dayLabel)}</div>
        <div style="color:#6B5A3E;font-size:13px;margin-bottom:16px">${escapeHtml(weekTheme)}</div>
        <div style="margin-bottom:16px;font-size:13px">
          streak <b style="color:#FFD08A">${streak}d</b> &nbsp;·&nbsp;
          discipline <b style="color:#FFB347">${Math.round(overall * 100)}%</b>
        </div>
        <table style="width:100%;border:1px solid #3A2F1C;background:#1E1810;border-collapse:collapse">
          ${rows}
        </table>
        <div style="margin-top:20px">
          <a href="${appUrl}" style="color:#FFB347;text-decoration:underline;font-size:13px">open today's tracker →</a>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
