// netlify/functions/lib/pricing.js
//
// Single source of truth for credit package pricing. Nothing in the
// frontend hardcodes amounts — it only ever displays what this file
// returns via /.netlify/functions/credits-checkout. Edit prices here.
//
// Amounts are in whole Naira (converted to kobo where the gateway
// needs it). Swap CURRENCY + amounts if you add international
// payments later — nothing else needs to change.

const CURRENCY = 'NGN';

const PACKAGES = {
  '1': { credits: 1, amount: 1000, label: '1 Email' },
  '10': { credits: 10, amount: 8000, label: '10 Emails' },
  '50': { credits: 50, amount: 35000, label: '50 Emails' },
  '100': { credits: 100, amount: 60000, label: '100 Emails' },
};

module.exports = { CURRENCY, PACKAGES };
