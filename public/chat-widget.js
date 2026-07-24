// public/chat-widget.js
//
// This runs in the visitor's browser. It never sees your API key —
// it only talks to /.netlify/functions/chat, which runs on the server.

const CLIENT_ID = 'default'; // change this per client site if reusing the engine

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

async function sendMessage() {
  const text = inputEl.value.trim();
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

addMessage("Hi! I'm the AI Launch Africa assistant. Ask me anything.", 'bot');
