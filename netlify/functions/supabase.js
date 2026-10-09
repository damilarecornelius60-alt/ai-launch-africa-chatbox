// netlify/functions/lib/supabase.js
//
// Minimal Supabase REST/RPC client using fetch — no npm dependency,
// consistent with the rest of this project. Uses the SERVICE ROLE
// key, which must only ever be read server-side (Netlify Functions),
// never sent to the browser.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertConfigured() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.');
  }
}

function authHeaders(extra) {
  return {
    'Content-Type': 'application/json',
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extra,
  };
}

// Calls a Postgres function defined in supabase/schema.sql, e.g.
// rpc('reserve_credit', {}) or rpc('credit_payment', { p_reference, p_credits }).
async function rpc(fn, args = {}) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`Supabase RPC ${fn} failed: ${res.status}`);
    err.details = data;
    throw err;
  }
  return data;
}

// Simple PostgREST table access, e.g.
// table('payment_transactions', { query: '?reference=eq.ABC&select=*' })
// table('payment_transactions', { method: 'POST', body: {...} })
async function table(name, { method = 'GET', query = '', body } = {}) {
  assertConfigured();
  const headers = authHeaders(
    method === 'POST' || method === 'PATCH' ? { Prefer: 'return=representation' } : {}
  );
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${name}${query}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`Supabase table ${name} ${method} failed: ${res.status}`);
    err.details = data;
    throw err;
  }
  return data;
}

module.exports = { rpc, table };
