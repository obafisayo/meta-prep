export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-5";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { messages, system, max_tokens } = body;
  if (!Array.isArray(messages) || !messages.length) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: max_tokens || 1000,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Anthropic API ${res.status}: ${text}` }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
