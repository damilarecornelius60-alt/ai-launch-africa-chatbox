// netlify/functions/clients.js
//
// This is where you configure each client's chatbot personality.
// Add a new entry for every new client — the frontend just needs
// to send the matching "clientId" and this file picks the right
// system prompt automatically. No need to duplicate the whole engine.

module.exports = {
  default: {
    name: 'AI Launch Africa Assistant',
    systemPrompt:
      'You are a helpful, friendly assistant for AI Launch Africa, an AI services agency ' +
      'helping African businesses adopt and launch AI solutions. Keep answers clear, concise, ' +
      'and practical.',
  },

  // Example of a second client — duplicate this block and edit
  // to onboard a new business. Just make sure clientId here
  // matches what the frontend sends.
  //
  // acmeStore: {
  //   name: 'Acme Store Assistant',
  //   systemPrompt:
  //     'You are a customer support assistant for Acme Store, an online retailer ' +
  //     'in Lagos selling electronics. Be warm, concise, and always mention ' +
  //     'delivery times when relevant.',
  // },
};
