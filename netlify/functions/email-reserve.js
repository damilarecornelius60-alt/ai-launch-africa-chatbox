// netlify/functions/email-reserve.js
//
// POST -> atomically reserves 1 credit before we attempt to send an
// outreach email. Returns 402 if there are 0 credits. The credit is
// only *reserved* here — email-send.js either finalizes it (consume)
// or gives it back (release) depending on whether the send actually
// succeeds.

const { rpc } = require('./lib/supabase.js');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Use POST.' }) };
  }

  try {
    const rows = await rpc('reserve_credit', {});
    const result = rows && rows[0];

    if (!result || result.ledger_id == null) {
      return { statusCode: 402, body: JSON.stringify({ error: "You've run out of email credits." }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ledgerId: result.ledger_id, remainingCredits: result.remaining_credits }),
    };
  } catch (err) {
    console.error('email-reserve error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not reserve credit.' }) };
  }
};
