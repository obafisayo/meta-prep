import { getStudyState, saveStudyState } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getStudyState();
    return Response.json(state);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { weakAreas, sessions } = await request.json();
    await saveStudyState(weakAreas || [], sessions || 0);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
