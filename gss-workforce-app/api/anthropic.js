// POST /api/anthropic
// Body: { messages: [...], system?: string, model?: string, max_tokens?: number }
// Proxies to Anthropic with the server-side API key.
// Requires a valid Supabase session (so only your logged-in admins can use it).
//
// Env vars:
//   ANTHROPIC_API_KEY       (sk-ant-...)
//   ANTHROPIC_MODEL         (optional, default: claude-sonnet-4-5-20250929)

import { requireUser, applyCors } from "./_auth.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const {
    messages,
    system,
    model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    max_tokens = 1024,
  } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages[] required" });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens,
        system: system ||
          `You are the GSS Workforce assistant for Global Security Solutions (Michigan). ` +
          `Help supervisors draft attendance write-ups, corrective action plans, termination ` +
          `notices, separation letters, UIA summaries, and onboarding materials. Always treat ` +
          `drafts as for supervisor review only. Separate verified facts from allegations. ` +
          `Never fabricate prior history or pay info. Use neutral, factual language.`,
        messages,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data });
    }
    const text = data?.content?.[0]?.text ?? "";
    return res.status(200).json({ text, raw: data });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
