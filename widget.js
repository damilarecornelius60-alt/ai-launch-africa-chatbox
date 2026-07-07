/**
 * AI Launch Africa — embeddable chat widget
 *
 * A client adds this to their site with:
 *   <script src="https://YOUR-DEPLOYED-URL.com/widget.js" data-client="savanna-grill"></script>
 *
 * That's it — no other setup needed on their end.
 */
(function () {
  const scriptTag = document.currentScript;
  const clientId = scriptTag.getAttribute('data-client');
  const apiBase = new URL(scriptTag.src).origin;
  const sessionId = clientId + '-' + Math.random().toString(36).slice(2, 10);

  if (!clientId) {
    console.error('AI Launch Africa widget: missing data-client attribute');
    return;
  }

  // --- Minimal styles, scoped to avoid clashing with host site ---
  const style = document.createElement('style');
  style.textContent = `
    #ala-fab{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;
      background:linear-gradient(135deg,#142868,#7C5CFC);color:#fff;border:none;cursor:pointer;
      box-shadow:0 10px 24px -6px rgba(10,17,40,.35);z-index:99999;font-size:22px;}
    #ala-panel{position:fixed;right:20px;bottom:86px;width:320px;max-height:440px;background:#fff;
      border-radius:16px;box-shadow:0 24px 48px -16px rgba(10,17,40,.4);z-index:99999;
      display:none;flex-direction:column;overflow:hidden;font-family:sans-serif;}
    #ala-panel.open{display:flex;}
    #ala-head{background:linear-gradient(135deg,#142868,#7C5CFC);color:#fff;padding:12px 14px;font-size:14px;font-weight:600;}
    #ala-body{flex:1;overflow-y:auto;padding:12px;background:#F6F5FC;display:flex;flex-direction:column;gap:8px;}
    .ala-msg{max-width:85%;padding:8px 11px;border-radius:12px;font-size:13px;line-height:1.4;}
    .ala-msg.bot{background:#fff;border:1px solid #E7E5F5;align-self:flex-start;}
    .ala-msg.user{background:#142868;color:#fff;align-self:flex-end;}
    #ala-input-row{display:flex;gap:6px;padding:10px;border-top:1px solid #E7E5F5;background:#fff;}
    #ala-input{flex:1;border:1px solid #E7E5F5;border-radius:999px;padding:8px 12px;font-size:13px;}
    #ala-send{background:#7C5CFC;color:#fff;border:none;border-radius:50%;width:34px;height:34px;cursor:pointer;}
  `;
  document.head.appendChild(style);

  // --- Markup ---
  const fab = document.createElement('button');
  fab.id = 'ala-fab';
  fab.innerHTML = '💬';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'ala-panel';
  panel.innerHTML = `
    <div id="ala-head">Chat with us</div>
    <div id="ala-body"></div>
    <div id="ala-input-row">
      <input id="ala-input" type="text" placeholder="Type a message..." />
      <button id="ala-send">➤</button>
    </div>
  `;
  document.body.appendChild(panel);

  const body = panel.querySelector('#ala-body');
  const input = panel.querySelector('#ala-input');
  const sendBtn = panel.querySelector('#ala-send');

  function addMsg(text, who) {
    const div = document.createElement('div');
    div.className = 'ala-msg ' + who;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, 'user');
    input.value = '';

    try {
      const res = await fetch(apiBase + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, sessionId, message: text }),
      });
      const data = await res.json();
      addMsg(data.reply || 'Sorry, something went wrong.', 'bot');
    } catch (e) {
      addMsg('Sorry, I could not connect. Please try again.', 'bot');
    }
  }

  fab.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && body.children.length === 0) {
      addMsg('Hi! How can I help you today?', 'bot');
    }
  });
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
})();
