// humanity.js — Humanity API token pending; returns service-unavailable for all actions
import { verifyAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(503).json({
    error: 'Humanity integration is pending API token provisioning.',
    details: 'This feature will be enabled once the Humanity API token is available.',
    available: false
  });
}

