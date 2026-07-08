export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-5";
const UNAVAILABLE = "AI service is temporarily unavailable. Please try again shortly.";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not configured");
    return Response.json({ error: UNAVAILABLE }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { messages, system, max_tokens, tool } = body;
  if (!Array.isArray(messages) || !messages.length) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const payload = {
    model: MODEL,
    max_tokens: max_tokens || 4096,
    system,
    messages,
  };
  // Tool-use forces the model to return schema-conformant structured data
  // instead of free text it might format as slightly-invalid JSON.
  if (tool) {
    payload.tools = [tool];
    payload.tool_choice = { type: "tool", name: tool.name };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Anthropic API error", res.status, text);
      return Response.json({ error: UNAVAILABLE }, { status: 502 });
    }

    const data = await res.json();

    if (data.stop_reason === "max_tokens") {
      console.error("Anthropic response truncated by max_tokens", payload.max_tokens);
      return Response.json({ error: "Response was too long and got cut off — please retry." }, { status: 502 });
    }

    if (tool) {
      const block = data.content.find((b) => b.type === "tool_use");
      if (!block) {
        console.error("Anthropic response missing tool_use block", JSON.stringify(data));
        return Response.json({ error: "AI did not return the expected structured response." }, { status: 502 });
      }
      return Response.json({ input: block.input });
    }

    const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return Response.json({ text });
  } catch (err) {
    console.error("Claude proxy error", err);
    return Response.json({ error: UNAVAILABLE }, { status: 500 });
  }
}
