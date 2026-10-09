// netlify/functions/credits-checkout.js
//
// POST { package: "10" } -> creates a pending payment_transactions row
// with a unique reference and returns what the browser needs to open
// the Remita Inline Checkout widget. Only Remita's PUBLIC key goes to
// the browser — never a secret key. Prices come from lib/pricing.js,
// not from anything the frontend sends.

const crypto = require('crypto');
const { table } = require('./lib/supabase.js');
const { PACKAGES, CURRENCY } = require('./lib/pricing.js');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Use POST.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON.' }) };
  }

  const pkg = PACKAGES[body.package];
  if (!pkg) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Unknown package.', validPackages: Object.keys(PACKAGES) }),
    };
  }

  const reference = `ALA-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    await table('payment_transactions', {
      method: 'POST',
      body: {
        reference,
        package: body.package,
        credits: pkg.credits,
        amount: pkg.amount,
        currency: CURRENCY,
        gateway: 'remita',
        status: 'pending',
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference,
        amount: pkg.amount,
        currency: CURRENCY,
        credits: pkg.credits,
        remitaPublicKey: process.env.REMITA_PUBLIC_KEY,
        payerEmail: process.env.ACCOUNT_EMAIL,
        payerName: process.env.ACCOUNT_NAME || 'AI Launch Africa',
      }),
    };
  } catch (err) {
    console.error('credits-checkout error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not start checkout.' }) };
  }
};
