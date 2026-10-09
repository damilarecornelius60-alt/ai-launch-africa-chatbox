// netlify/functions/credits-balance.js
//
// GET current credit balance plus recent activity (purchases and
// email sends), for the credit badge and the billing/history panel.

const { table } = require('./lib/supabase.js');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Use GET.' }) };
  }

  try {
    const account = await table('account', { query: '?id=eq.1&select=credits' });
    const ledger = await table('credit_ledger', {
      query: '?select=*&order=created_at.desc&limit=20',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credits: account[0]?.credits ?? 0,
        recent: ledger,
      }),
    };
  } catch (err) {
    console.error('credits-balance error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load balance.' }) };
  }
};
