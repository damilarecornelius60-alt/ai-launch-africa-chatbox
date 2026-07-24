// netlify/functions/chat.js
//
// This function runs on Netlify's servers, NOT in the browser.
// That's what keeps your ANTHROPIC_API_KEY safe — the browser
// never sees it, only ever talks to this function.

const CLIENT_CONFIG = require('./clients.js');

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON in request body.' }),
    };
  }

  const { message, history, clientId } = body;

  if (!message || typeof message !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing "message" field (string).' }),
    };
  }

  // Look up the client's system prompt / personality.
  // If no clientId is sent, fall back to the "default" client.
  const client = CLIENT_CONFIG[clientId] || CLIENT_CONFIG.default;

  // Build the conversation to send to Claude.
  // `history` should be an array of { role: "user"|"assistant", content: "..." }
  const messages = Array.isArray(history) ? [...history] : [];
  messages.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system: client.systemPrompt,
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'Anthropic API error.' }),
      };
    }

    const replyText = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: replyText }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error calling Claude API.' }),
    };
  }
};
