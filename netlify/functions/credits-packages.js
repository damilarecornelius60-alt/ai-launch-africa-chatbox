// netlify/functions/credits-packages.js
//
// GET the list of credit packages and their current prices, straight
// from lib/pricing.js. The frontend renders the Buy Credits buttons
// from this response instead of hardcoding any price.

const { PACKAGES, CURRENCY } = require('./lib/pricing.js');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Use GET.' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currency: CURRENCY, packages: PACKAGES }),
  };
};
