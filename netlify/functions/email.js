// netlify/functions/lib/email.js
//
// Shared Resend helper. Resend's free tier covers 3,000 emails/month
// (100/day) — get a key at resend.com and verify a sending domain
// there before going live (until then it will only send to your own
// verified address).

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'AI Launch Africa <onboarding@resend.dev>';
const ACCOUNT_EMAIL = process.env.ACCOUNT_EMAIL; // your own inbox — this is a single-account system

async function send({ to, subject, text, html }) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set.');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`Resend send failed: ${res.status}`);
    err.details = data;
    throw err;
  }
  return data;
}

// The actual outreach email to a prospect — this is what a credit pays for.
async function sendOutreachEmail({ to, subject, text }) {
  return send({ to, subject, text });
}

// Receipt sent to you (the account owner) once a payment is verified.
async function sendPaymentReceipt({ reference, amount, credits, currency = 'NGN' }) {
  if (!ACCOUNT_EMAIL) return; // no recipient configured — skip quietly
  return send({
    to: ACCOUNT_EMAIL,
    subject: `Payment confirmed — ${credits} email credits added`,
    text:
      `Your payment was verified and ${credits} email credit${credits === 1 ? '' : 's'} ` +
      `were added to your AI Launch Africa account.\n\n` +
      `Reference: ${reference}\nAmount: ${currency} ${amount}\n`,
  });
}

module.exports = { sendOutreachEmail, sendPaymentReceipt };
