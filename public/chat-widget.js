// public/chat-widget.js
//
// This runs in the visitor's browser. It never sees your API key —
// it only talks to /.netlify/functions/chat, which runs on the server.

// clientId and target (company name/URL) can arrive via the query string,
// e.g. chat.html?clientId=marketlead&target=acmelogistics.com
// This is how the search page hands off into a running conversation.
const urlParams = new URLSearchParams(window.location.search);
const CLIENT_ID = urlParams.get('clientId') || 'default';
const TARGET = urlParams.get('target');

const messagesEl = document.getElementById('chat-messages');
const inputEl = document.getElementById('chat-input');
const sendBtn = document.getElementById('chat-send');

let history = []; // { role: "user"|"assistant", content: "..." }

function addMessage(text, role) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function sendMessage(presetText) {
  const text = (presetText !== undefined ? presetText : inputEl.value).trim();
  if (!text) return;

  addMessage(text, 'user');
  inputEl.value = '';
  sendBtn.disabled = true;

  const thinkingEl = addMessage('Thinking...', 'bot thinking');

  try {
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: history,
        clientId: CLIENT_ID,
      }),
    });

    const data = await response.json();
    thinkingEl.remove();

    if (!response.ok) {
      addMessage(`Error: ${data.error || 'Something went wrong.'}`, 'bot');
      sendBtn.disabled = false;
      return;
    }

    addMessage(data.reply, 'bot');

    // Keep history so the bot remembers the conversation
    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: data.reply });
  } catch (err) {
    thinkingEl.remove();
    addMessage('Error: could not reach the server.', 'bot');
  }

  sendBtn.disabled = false;
  inputEl.focus();
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

if (TARGET) {
  // Came from the search page with a company already chosen —
  // kick off Step 1 immediately instead of waiting for the user to type.
  sendMessage(`Let's start. My company is: ${TARGET}`);
} else {
  addMessage("Hi! I'm the AI Launch Africa assistant. Ask me anything.", 'bot');
}
