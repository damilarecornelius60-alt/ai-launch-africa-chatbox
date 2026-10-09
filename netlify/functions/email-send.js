// netlify/functions/email-send.js
//
// POST { ledgerId, recipientEmail, recipientCompany, subject, body }
// Sends the outreach email via Resend. On success, permanently
// consumes the reserved credit and logs it in sent_emails. On
// failure, releases the credit back to the balance — nothing is
// charged for an email that never went out.

const { rpc, table } = require('./lib/supabase.js');
const { sendOutreachEmail } = require('./lib/email.js');

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

  const { ledgerId, recipientEmail, recipientCompany, subject, body: emailBody } = body;
  if (!ledgerId || !recipientEmail || !subject || !emailBody) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields.' }) };
  }

  try {
    await sendOutreachEmail({ to: recipientEmail, subject, text: emailBody });

    await rpc('consume_credit', { p_ledger_id: ledgerId });
    await table('sent_emails', {
      method: 'POST',
      body: {
        recipient_company: recipientCompany || null,
        recipient_email: recipientEmail,
        subject,
        body: emailBody,
        status: 'sent',
        credit_ledger_id: ledgerId,
      },
    });

    return { statusCode: 200, body: JSON.stringify({ sent: true }) };
  } catch (err) {
    console.error('email-send error:', err);

    try {
      await rpc('release_credit', { p_ledger_id: ledgerId });
      await table('sent_emails', {
        method: 'POST',
        body: {
          recipient_company: recipientCompany || null,
          recipient_email: recipientEmail,
          subject,
          body: emailBody,
          status: 'failed',
          credit_ledger_id: ledgerId,
        },
      });
    } catch (releaseErr) {
      console.error('failed to release credit:', releaseErr);
    }

    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Email failed to send — your credit was not charged.' }),
    };
  }
};
