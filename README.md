# AI Launch Africa — Chatbot Engine

One backend, reused for every client. Adding a new client is editing a config
file, not building a new chatbot.

## How it works

1. `server.js` runs a small API with one main endpoint: `POST /chat`
2. Each client's business info lives in `config/clients.json`
3. A client's website loads `widget.js` with their `clientId` — the widget
   talks to your server, your server asks Claude, the reply comes back.

## 1. Local setup

```bash
npm install
cp .env.example .env
# then open .env and paste your real Anthropic API key
npm start
```

Server runs at `http://localhost:3000`.

Test it:
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"clientId":"savanna-grill","message":"Do you deliver to Lekki?"}'
```

## 2. Adding a new client (this is your main day-to-day task)

Open `config/clients.json` and add a new entry, e.g.:

```json
"adaeze-studio": {
  "businessName": "Adaeze Studio",
  "tone": "friendly, stylish, uses emoji sparingly",
  "systemPrompt": "You are the AI assistant for Adaeze Studio, a fashion store in Accra...",
  "knowledge": [
    "Sizes run true to international standard; sizing chart on the product page.",
    "Delivery: 2-3 days within Accra, 5-7 days nationwide.",
    "Returns accepted within 7 days if tags are still attached."
  ],
  "whatsappNumber": "233000000000"
}
```

No code changes, no redeploy needed if you're hosting `clients.json`
somewhere editable — for now it redeploys with the server, which is fine
at small scale.

## 3. Giving it to a client

They add one line to their website:

```html
<script src="https://YOUR-DEPLOYED-URL.com/widget.js" data-client="adaeze-studio"></script>
```

That's the entire integration on their end.

## 4. Deploying (so it has a real URL, not just localhost)

Recommended: **Render** (free tier is enough to start)

1. Push this folder to a GitHub repo
2. On Render: New → Web Service → connect the repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variable `ANTHROPIC_API_KEY` in Render's dashboard
6. Deploy — Render gives you a URL like `https://ai-launch-africa-chatbot.onrender.com`

Use that URL in place of `YOUR-DEPLOYED-URL.com` above.

## 5. Cost reality check

Model used: `claude-haiku-4-5` — cheap and fast, plenty capable for FAQs,
orders, and bookings. Roughly $1 per million input tokens, $5 per million
output tokens. A typical short customer conversation costs a small fraction
of a cent. Even a client getting hundreds of chats a month costs you only a
few dollars in API usage — comfortably inside your $149–349/mo pricing.

## 6. What's next (not built yet)

- **WhatsApp integration**: connect this same `/chat` endpoint to the
  WhatsApp Business API (via Meta directly or a wrapper like Twilio/360dialog)
  so the same engine answers on WhatsApp, not just the website widget.
- **Persistent history**: right now conversation history lives in memory and
  resets if the server restarts — fine for demos, worth swapping for a
  database (e.g. a simple Postgres table) once you have paying clients.
- **Admin UI**: eventually a simple form instead of hand-editing JSON, so you
  (or a client) can update their bot's knowledge without touching code.
