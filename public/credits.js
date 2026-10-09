// public/credits.js
//
// Handles the credit badge, the Buy Credits flow (Remita Inline
// Checkout), and the "send outreach email" panel. Loaded on chat.html
// alongside chat-widget.js — it doesn't touch the chat logic at all.
//
// Note: the AI drafts outreach emails inside the chat conversation as
// plain text. This panel doesn't try to auto-parse that text (fragile) —
// copy the subject/body from the chat into the fields below, then send.

const creditsBadgeEl = document.getElementById('credits-badge');
const buyBtn = document.getElementById('buy-credits-btn');
const modal = document.getElementById('buy-credits-modal');
const modalClose = document.getElementById('buy-credits-close');
const modalStatus = document.getElementById('buy-credits-status');
const packageGrid = document.getElementById('package-grid');

let packagesLoaded = false;

// Prices come from the server (lib/pricing.js) — nothing here is hardcoded.
async function loadPackages() {
  if (packagesLoaded) return;
  try {
    const res = await fetch('/.netlify/functions/credits-packages');
    const data = await res.json();
    const formatter = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: data.currency || 'NGN',
      maximumFractionDigits: 0,
    });

    packageGrid.innerHTML = '';
    Object.entries(data.packages).forEach(([key, pkg]) => {
      const btn = document.createElement('button');
      btn.className = 'package-btn';
      btn.dataset.package = key;
      btn.textContent = `${pkg.label} — ${formatter.format(pkg.amount)}`;
      btn.addEventListener('click', () => startCheckout(key, btn));
      packageGrid.appendChild(btn);
    });
    packagesLoaded = true;
  } catch (err) {
    packageGrid.innerHTML = '<p class="hint">Could not load packages. Try again shortly.</p>';
  }
}

const sendForm = document.getElementById('send-email-form');
const sendStatus = document.getElementById('send-email-status');

let currentCredits = 0;

function renderBadge() {
  creditsBadgeEl.textContent = `✉ ${currentCredits} credit${currentCredits === 1 ? '' : 's'}`;
}

async function refreshBalance() {
  try {
    const res = await fetch('/.netlify/functions/credits-balance');
    const data = await res.json();
    currentCredits = data.credits ?? 0;
    renderBadge();
  } catch (err) {
    creditsBadgeEl.textContent = '✉ —';
  }
}

buyBtn.addEventListener('click', () => {
  modalStatus.textContent = '';
  modal.style.display = 'flex';
  loadPackages();
});
modalClose.addEventListener('click', () => {
  modal.style.display = 'none';
});

async function startCheckout(packageKey) {
  modalStatus.textContent = 'Starting checkout...';
  try {
    const res = await fetch('/.netlify/functions/credits-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: packageKey }),
    });
    const config = await res.json();
    if (!res.ok) {
      modalStatus.textContent = config.error || 'Could not start checkout.';
      return;
    }
    openRemitaWidget(config);
  } catch (err) {
    modalStatus.textContent = 'Network error — please try again.';
  }
}

function openRemitaWidget(config) {
  if (typeof RmPaymentEngine === 'undefined') {
    modalStatus.textContent = 'Payment widget failed to load. Refresh and try again.';
    return;
  }
  modalStatus.textContent = 'Opening Remita checkout...';

  const engine = RmPaymentEngine.init({
    key: config.remitaPublicKey,
    customerId: config.payerEmail,
    firstName: config.payerName,
    lastName: '',
    email: config.payerEmail,
    amount: config.amount,
    transactionId: config.reference,
    onSuccess: async function () {
      modalStatus.textContent = 'Verifying payment...';
      await verifyPayment(config.reference);
    },
    onError: function () {
      modalStatus.textContent = 'Payment failed or was declined.';
    },
    onClose: function () {
      if (modalStatus.textContent === 'Opening Remita checkout...') {
        modalStatus.textContent = 'Payment window closed.';
      }
    },
  });
  engine.showPaymentWidget();
}

async function verifyPayment(reference) {
  try {
    const res = await fetch('/.netlify/functions/credits-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    });
    const data = await res.json();

    if (data.status === 'successful') {
      currentCredits = data.credits;
      renderBadge();
      modalStatus.textContent = 'Payment confirmed — credits added!';
      setTimeout(() => {
        modal.style.display = 'none';
        modalStatus.textContent = '';
      }, 1500);
    } else if (data.status === 'verification_failed') {
      modalStatus.textContent =
        'We could not verify this payment. If you were charged, keep this reference: ' + reference;
    } else {
      modalStatus.textContent = 'Payment status: ' + data.status;
    }
  } catch (err) {
    modalStatus.textContent = 'Could not verify payment — reference: ' + reference;
  }
}

// --- Send outreach email panel ---

sendForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (currentCredits < 1) {
    sendStatus.textContent = "You've run out of email credits.";
    return;
  }

  const recipientEmail = document.getElementById('send-email-to').value.trim();
  const recipientCompany = document.getElementById('send-email-company').value.trim();
  const subject = document.getElementById('send-email-subject').value.trim();
  const emailBody = document.getElementById('send-email-body').value.trim();

  if (!recipientEmail || !subject || !emailBody) {
    sendStatus.textContent = 'Fill in the recipient, subject, and email body.';
    return;
  }

  sendStatus.textContent = '1 email credit will be used. Sending...';

  let ledgerId;
  try {
    const reserveRes = await fetch('/.netlify/functions/email-reserve', { method: 'POST' });
    const reserveData = await reserveRes.json();
    if (!reserveRes.ok) {
      sendStatus.textContent = reserveData.error || "You've run out of email credits.";
      return;
    }
    ledgerId = reserveData.ledgerId;
    currentCredits = reserveData.remainingCredits;
    renderBadge();
  } catch (err) {
    sendStatus.textContent = 'Could not reach the server.';
    return;
  }

  try {
    const sendRes = await fetch('/.netlify/functions/email-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ledgerId, recipientEmail, recipientCompany, subject, body: emailBody }),
    });
    const sendData = await sendRes.json();

    if (sendRes.ok && sendData.sent) {
      sendStatus.textContent = 'Email sent!';
      sendForm.reset();
    } else {
      sendStatus.textContent = sendData.error || 'Send failed — your credit was refunded.';
      await refreshBalance();
    }
  } catch (err) {
    sendStatus.textContent = 'Send failed — your credit was refunded.';
    await refreshBalance();
  }
});

refreshBalance();
