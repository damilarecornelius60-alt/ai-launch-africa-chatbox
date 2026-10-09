// netlify/functions/credits-verify.js
//
// POST { reference } -> called by the browser right after the Remita
// widget reports success. That report is NEVER trusted on its own:
// this function re-checks the transaction directly with Remita's
// servers, using your secret API key, before adding any credits.
//
// Safe to call more than once for the same reference (e.g. a retried
// request) — credits are only ever added once, enforced inside the
// credit_payment() database function (supabase/schema.sql).

const crypto = require('crypto');
const { rpc, table } = require('./lib/supabase.js');
const { sendPaymentReceipt } = require('./lib/email.js');

const REMITA_BASE =
  process.env.REMITA_LIVE === 'true'
    ? 'https://login.remita.net/remita/ecomm'
    : 'https://remitademo.net/remita/ecomm';

// NOTE: Remita has several API generations with slightly different
// docs depending on when your merchant account was set up. This uses
// the commonly-documented RRR/orderId status-check pattern
// (sha512 of orderId + apiKey + merchantId). Before going live,
// confirm this exact hash order and endpoint path against the API
// reference linked from your own Remita merchant dashboard, and test
// a full purchase in the demo environment first.
async function checkRemitaStatus(reference) {
  const merchantId = process.env.REMITA_MERCHANT_ID;
  const apiKey = process.env.REMITA_API_KEY;

  const hash = crypto
    .createHash('sha512')
    .update(`${reference}${apiKey}${merchantId}`)
    .digest('hex');

  const url = `${REMITA_BASE}/${merchantId}/${reference}/${hash}/orderstatus.reg`;
  const res = await fetch(url);
  return res.json(); // expect { status: '00' | '01', ... } on a successful payment
}

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

  const { reference } = body;
  if (!reference) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing reference.' }) };
  }

  try {
    const rows = await table('payment_transactions', {
      query: `?reference=eq.${encodeURIComponent(reference)}&select=*`,
    });
    const txn = rows[0];
    if (!txn) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Unknown reference.' }) };
    }

    // Already processed — just report the current balance, don't re-add credits.
    if (txn.status === 'successful') {
      const acc = await table('account', { query: '?id=eq.1&select=credits' });
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'successful', credits: acc[0]?.credits ?? 0 }),
      };
    }

    const remitaResult = await checkRemitaStatus(reference);
    const paid = remitaResult && (remitaResult.status === '00' || remitaResult.status === '01');

    if (!paid) {
      await table('payment_transactions', {
        method: 'PATCH',
        query: `?reference=eq.${encodeURIComponent(reference)}`,
        body: {
          status: 'verification_failed',
          raw_gateway_response: remitaResult,
          updated_at: new Date().toISOString(),
        },
      });
      return { statusCode: 200, body: JSON.stringify({ status: 'verification_failed' }) };
    }

    const rpcRows = await rpc('credit_payment', { p_reference: reference, p_credits: txn.credits });
    const result = rpcRows[0];

    if (!result.already_processed) {
      try {
        await sendPaymentReceipt({
          reference,
          amount: txn.amount,
          credits: txn.credits,
          currency: txn.currency,
        });
      } catch (emailErr) {
        // Don't fail the payment over a receipt email.
        console.error('receipt email failed:', emailErr);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'successful', credits: result.new_balance }),
    };
  } catch (err) {
    console.error('credits-verify error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Verification failed.' }) };
  }
};
