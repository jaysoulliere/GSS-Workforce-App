// /api/humanity
// Proxies a small set of TCP Humanity REST API operations.
// Requires a valid Supabase session.
//
// Env vars:
//   HUMANITY_API_TOKEN     (Bearer token from Humanity → Settings → API)
//   HUMANITY_BASE          (optional, default https://www.humanity.com/api/v2)
//
// Supported actions (POST body { action, ... }):
//   - "list_timeclocks"   { start_date, end_date, location_id? }
//   - "create_shift"      { employee_id, location_id, schedule_id, start_time, end_time, notes? }
//   - "create_user"       { first_name, last_name, email, username, password, hourly_rate, position_assignment, employment_type? }
//   - "list_employees"    { search? }
//
// NOTE: Humanity's API responses vary across accounts/plans. This module is a thin pass-through;
// the frontend renders whatever JSON comes back. If your account uses different endpoint paths,
// adjust the URL templates below.

import { requireUser, applyCors } from "./_auth.js";

const BASE = process.env.HUMANITY_BASE || "https://www.humanity.com/api/v2";

async function humanity(path, init = {}) {
  const url = BASE + path + (path.includes("?") ? "&" : "?") + "access_token=" + encodeURIComponent(process.env.HUMANITY_API_TOKEN);
  const r = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await r.json() : await r.text();
  return { ok: r.ok, status: r.status, body };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { action, ...args } = req.body || {};

  try {
    let result;
    switch (action) {
      case "list_timeclocks": {
        const params = new URLSearchParams();
        if (args.start_date)  params.set("start_date", args.start_date);
        if (args.end_date)    params.set("end_date",   args.end_date);
        if (args.location_id) params.set("location",   String(args.location_id));
        result = await humanity("/timeclocks?" + params.toString());
        break;
      }
      case "list_employees": {
        const params = new URLSearchParams();
        if (args.search) params.set("search", args.search);
        result = await humanity("/employees?" + params.toString());
        break;
      }
      case "create_shift": {
        result = await humanity("/shifts", {
          method: "POST",
          body: JSON.stringify({
            employees: [args.employee_id],
            location:  args.location_id,
            schedule:  args.schedule_id,
            start_time: args.start_time,
            end_time:   args.end_time,
            notes:     args.notes || "",
          }),
        });
        break;
      }
      case "create_user": {
        result = await humanity("/employees", {
          method: "POST",
          body: JSON.stringify({
            first_name:  args.first_name,
            last_name:   args.last_name,
            email:       args.email,
            username:    args.username,
            password:    args.password,
            hourly_rate: args.hourly_rate ?? 16,
            position:    args.position_assignment,
            employment_type: args.employment_type || "Full-time",
            send_activation: false,
          }),
        });
        break;
      }
      default:
        return res.status(400).json({ error: "unknown action: " + action });
    }
    return res.status(result.ok ? 200 : result.status).json(result.body);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
