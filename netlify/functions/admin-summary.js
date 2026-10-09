// netlify/functions/admin-summary.js
//
// GET, protected by the ADMIN_SECRET env var (send it as an
// x-admin-key header, or ?key=... for quick manual checks). Returns
// the numbers for the admin/billing dashboard: totals, revenue, and
// recent transactions/emails.

const { table } = require('./lib/supabase.js');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Use GET.' }) };
  }

  const key = event.headers['x-admin-key'] || (event.queryStringParameters || {}).key;
  if (!process.env.ADMIN_SECRET || key !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized.' }) };
  }

  try {
    const payments = await table('payment_transactions', {
      query: '?select=*&order=created_at.desc&limit=200',
    });
    const emails = await table('sent_emails', {
      query: '?select=*&order=created_at.desc&limit=200',
    });
    const account = await table('account', { query: '?id=eq.1&select=credits' });

    const successful = payments.filter((p) => p.status === 'successful');
    const failed = payments.filter((p) => p.status === 'failed' || p.status === 'verification_failed');
    const revenue = successful.reduce((sum, p) => sum + Number(p.amount), 0);
    const creditsPurchased = successful.reduce((sum, p) => sum + p.credits, 0);
    const emailsSent = emails.filter((e) => e.status === 'sent').length;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentBalance: account[0]?.credits ?? 0,
        totalPayments: payments.length,
        successfulPayments: successful.length,
        failedPayments: failed.length,
        creditsPurchased,
        emailsSent,
        revenue,
        transactions: payments,
        emails,
      }),
    };
  } catch (err) {
    console.error('admin-summary error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load summary.' }) };
  }
};
