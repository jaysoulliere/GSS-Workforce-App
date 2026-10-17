// Shared Pipedream Connect client for Vercel serverless functions.
//
// Env vars:
//   PIPEDREAM_CLIENT_ID       (OAuth client ID from https://pipedream.com/settings/api)
//   PIPEDREAM_CLIENT_SECRET   (OAuth client secret)
// Project and environment are fixed to proj_9lsZN6Y / production.
//
// The client ID/secret are server-only secrets — never expose them to the browser.
// The browser talks to /api/connect-token, which mints short-lived Connect tokens
// scoped to the signed-in Supabase user.

import { PipedreamClient } from "@pipedream/sdk";

export function pipedreamClient() {
  if (!process.env.PIPEDREAM_CLIENT_ID || !process.env.PIPEDREAM_CLIENT_SECRET) {
    return null;
  }
  return new PipedreamClient({
    projectEnvironment: "production",
    clientId: process.env.PIPEDREAM_CLIENT_ID,
    clientSecret: process.env.PIPEDREAM_CLIENT_SECRET,
    projectId: "proj_9lsZN6Y",
  });
}

export const PIPEDREAM_NOT_CONFIGURED =
  "Pipedream Connect not configured: set PIPEDREAM_CLIENT_ID and PIPEDREAM_CLIENT_SECRET (see README)";
