require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CLIENTS_PATH = path.join(__dirname, 'config', 'clients.json');

function loadClients() {
  const raw = fs.readFileSync(CLIENTS_PATH, 'utf-8');
  return JSON.parse(raw);
}

// In-memory conversation history per session (fine for MVP; swap for a DB later)
const sessions = {};

app.post('/chat', async (req, res) => {
  try {
    const { clientId, sessionId, message } = req.body;

    if (!clientId || !message) {
      return res.status(400).json({ error: 'clientId and message are required' });
    }

    const clients = loadClients();
    const client = clients[clientId];

    if (!client) {
      return res.status(404).json({ error: `Unknown clientId: ${clientId}` });
    }

    const sid = sessionId || `${clientId}-anon`;
    if (!sessions[sid]) sessions[sid] = [];

    // Build the system prompt: role + tone + this client's specific knowledge
    const systemPrompt = [
      client.systemPrompt,
      `Tone: ${client.tone}`,
      `Business facts you know:\n- ${client.knowledge.join('\n- ')}`,
      `If the customer wants to speak to a human or finish an order, tell them to continue on WhatsApp at +${client.whatsappNumber}.`
    ].join('\n\n');

    // Add the user's new message to history
    sessions[sid].push({ role: 'user', content: message });

    // Keep only the last 10 turns to control token usage/cost
    const recentHistory = sessions[sid].slice(-10);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5', // cheapest current model, plenty capable for this
      max_tokens: 400,
      system: systemPrompt,
      messages: recentHistory,
    });

    const replyText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    sessions[sid].push({ role: 'assistant', content: replyText });

    res.json({ reply: replyText, businessName: client.businessName });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Simple health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// List configured clients (handy while testing)
app.get('/clients', (req, res) => {
  const clients = loadClients();
  res.json(Object.keys(clients));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Chatbot engine running on port ${PORT}`);
});
