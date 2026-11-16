let val = '0';
let old = null;
let operator = null;
let reset = false;
let secretBuffer = '';
let historyData = JSON.parse(localStorage.getItem('ios_calc_history') || '[]');

const displayEl = document.getElementById('display');
const exprEl = document.getElementById('expression');
const previewEl = document.getElementById('live-preview');
const clearBtn = document.getElementById('clear-btn');
const toastEl = document.getElementById('toast');

let audioCtx = null;
function playClick(isOperator = false) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isOperator ? 520 : 410, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.025);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.025);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.026);
  } catch (e) {}
}

function feedback(isOperator = false) {
  if (navigator.vibrate) navigator.vibrate(8);
  playClick(isOperator);
}

function formatNumberStr(raw) {
  if (raw === 'Error') return 'Error';
  const isNeg = raw.startsWith('-');
  const unsigned = isNeg ? raw.slice(1) : raw;
  const [intPart, decPart] = unsigned.split('.');
  const formattedInt = Number(intPart || '0').toLocaleString('en-US');
  const prefix = isNeg ? '−' : '';
  return decPart !== undefined ? `${prefix}${formattedInt}.${decPart}` : `${prefix}${formattedInt}`;
}

function compute(a, b, opSymbol) {
  let res;
  if (opSymbol === '+') res = a + b;
  if (opSymbol === '−') res = a - b;
  if (opSymbol === '×') res = a * b;
  if (opSymbol === '÷') res = b === 0 ? NaN : a / b;
  if (!Number.isFinite(res)) return null;
  return Math.round(res * 1e10) / 1e10;
}

function updateDisplay() {
  const formatted = formatNumberStr(val);
  displayEl.textContent = formatted;

  const len = formatted.length;
  if (len <= 7) displayEl.style.fontSize = '84px';
  else if (len <= 9) displayEl.style.fontSize = '68px';
  else if (len <= 11) displayEl.style.fontSize = '56px';
  else if (len <= 14) displayEl.style.fontSize = '46px';
  else displayEl.style.fontSize = '38px';

  clearBtn.textContent = (!reset && val !== '0' && val !== 'Error') ? '⌫' : 'AC';

  if (old !== null && operator && !reset && val !== 'Error') {
    const live = compute(old, Number(val), operator);
    previewEl.textContent = live !== null ? `= ${formatNumberStr(String(live))}` : '';
  } else {
    previewEl.textContent = '';
  }

  document.querySelectorAll('.orange[data-op]').forEach((btn) => {
    btn.classList.toggle('active', reset && operator === btn.dataset.op);
  });
}

function num(n) {
  feedback(false);
  secretBuffer = (secretBuffer + n).slice(-10);
  if (val === 'Error' || reset || val === '0') {
    val = n;
    reset = false;
  } else if (val.replace(/[-.]/g, '').length < 15) {
    val += n;
  }
  updateDisplay();
}

function decimal() {
  feedback(false);
  secretBuffer = '';
  if (val === 'Error' || reset) {
    val = '0.';
    reset = false;
  } else if (!val.includes('.')) {
    val += '.';
  }
  updateDisplay();
}

function backspace() {
  if (val === 'Error' || reset) {
    clearAll();
    return;
  }
  feedback(false);
  secretBuffer = secretBuffer.slice(0, -1);
  if (val.length <= 1 || (val.length === 2 && val.startsWith('-'))) {
    val = '0';
  } else {
    val = val.slice(0, -1);
  }
  updateDisplay();
}

function handleClear() {
  if (clearBtn.textContent === '⌫') {
    backspace();
  } else {
    clearAll();
  }
}

function clearAll() {
  feedback(false);
  val = '0';
  old = null;
  operator = null;
  reset = false;
  secretBuffer = '';
  exprEl.textContent = '';
  previewEl.textContent = '';
  updateDisplay();
}

function sign() {
  feedback(false);
  secretBuffer = '';
  if (val === 'Error' || val === '0') return;
  val = val.startsWith('-') ? val.slice(1) : '-' + val;
  reset = false;
  updateDisplay();
}

function percent() {
  feedback(false);
  secretBuffer = '';
  if (val === 'Error') return;
  const base = (old !== null && (operator === '+' || operator === '−'))
    ? (old * Number(val)) / 100
    : Number(val) / 100;
  val = String(Math.round(base * 1e10) / 1e10);
  reset = false;
  updateDisplay();
}

function op(o) {
  feedback(true);
  secretBuffer = '';
  if (val === 'Error') val = '0';
  if (operator && !reset) equal(true);
  old = Number(val);
  operator = o;
  reset = true;
  exprEl.textContent = `${formatNumberStr(String(old))} ${o}`;
  updateDisplay();
}

function equal(chaining = false) {
  if (!chaining) feedback(true);

  if (!chaining && old === null && !operator && triggerSecretCode(secretBuffer || val)) {
    secretBuffer = '';
    reset = true;
    return;
  }

  secretBuffer = '';
  if (old === null || !operator) return;
  const b = Number(val);
  const res = compute(old, b, operator);
  const expressionText = `${formatNumberStr(String(old))} ${operator} ${formatNumberStr(String(b))}`;
  exprEl.textContent = `${expressionText} =`;

  if (res === null) {
    val = 'Error';
  } else {
    val = String(res);
    if (!chaining) saveHistory(expressionText, formatNumberStr(val), val);
  }
  old = null;
  operator = null;
  reset = true;
  updateDisplay();
}

// === SECRET EASTER EGG CODES ===
const secretStyle = document.createElement('style');
document.head.appendChild(secretStyle);
let reflexTimer = null;
let reflexStart = 0;

function triggerSecretCode(code) {
  if (reflexTimer === 'ready') {
    const ms = Math.round(performance.now() - reflexStart);
    reflexTimer = null;
    exprEl.textContent = 'REFLEX SPEED';
    displayEl.textContent = `${ms} ms`;
    val = '0';
    return true;
  }
  if (code.endsWith('1999')) {
    secretStyle.textContent = `:root { --op-bg: #d4af37 !important; } #display { color: #f5d76e; }`;
    exprEl.textContent = 'IMPERIUM MODE UNLOCKED';
    showToast('Executive Gold Active');
    return true;
  }
  if (code.endsWith('2077')) {
    secretStyle.textContent = `:root { --op-bg: #ff007f !important; } #display { color: #00f5d4; text-shadow: 0 0 18px rgba(0,245,212,0.5); }`;
    showToast('Cyberpunk Mode Active');
    return true;
  }
  if (code.endsWith('007')) {
    secretStyle.textContent = `:root { --op-bg: #00c853 !important; } #display, #expression { color: #00ff41; }`;
    showToast('Stealth Mode Active');
    return true;
  }
  if (code.endsWith('0000')) {
    secretStyle.textContent = '';
    exprEl.textContent = '';
    showToast('Default Theme Restored');
    updateDisplay();
    return true;
  }
  if (code.endsWith('80085')) {
    const appEl = document.querySelector('.app');
    appEl.style.transition = 'transform 0.6s ease';
    appEl.style.transform = 'rotate(180deg)';
    setTimeout(() => { appEl.style.transform = 'rotate(0deg)'; }, 4000);
    return true;
  }
  if (code.endsWith('9999')) {
    let ticks = 0;
    const scramble = setInterval(() => {
      displayEl.textContent = Math.floor(100000000 + Math.random() * 900000000);
      ticks++;
      if (ticks > 22) {
        clearInterval(scramble);
        exprEl.textContent = 'SYSTEM OVERRIDE';
        displayEl.textContent = 'GRANTED';
        val = '0';
        reset = true;
      }
    }, 65);
    return true;
  }
  if (code.endsWith('1111')) {
    exprEl.textContent = 'WAIT FOR GREEN, THEN TAP =';
    displayEl.textContent = 'READY...';
    reflexTimer = 'waiting';
    setTimeout(() => {
      if (reflexTimer !== 'waiting') return;
      reflexTimer = 'ready';
      reflexStart = performance.now();
      displayEl.style.color = '#30d158';
      displayEl.textContent = 'TAP = NOW!';
    }, 1500 + Math.random() * 2500);
    return true;
  }
  if (code.endsWith('1234')) {
    const savedNote = localStorage.getItem('ios_calc_vault') || '';
    const updated = prompt('Private Calculator Vault:', savedNote);
    if (updated !== null) {
      localStorage.setItem('ios_calc_vault', updated);
      showToast('Vault Saved');
    }
    return true;
  }
  return false;
}

function saveHistory(expr, formattedRes, rawRes) {
  historyData.unshift({ expr, formattedRes, rawRes });
  if (historyData.length > 30) historyData.pop();
  localStorage.setItem('ios_calc_history', JSON.stringify(historyData));
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!historyData.length) {
    list.innerHTML = '<p style="color:var(--subtext);text-align:center;padding:24px 0;">No calculations yet</p>';
    return;
  }
  list.innerHTML = historyData.map((item, i) => `
    <div class="history-item" onclick="loadHistory(${i})">
      <small>${item.expr}</small>
      <strong>${item.formattedRes}</strong>
    </div>
  `).join('');
}

function loadHistory(index) {
  val = historyData[index].rawRes;
  reset = true;
  toggleHistory(false);
  updateDisplay();
}

function clearHistory() {
  historyData = [];
  localStorage.removeItem('ios_calc_history');
  renderHistory();
}

function toggleHistory(open) {
  const modal = document.getElementById('history-modal');
  if (open) renderHistory();
  modal.classList.toggle('open', open);
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1600);
}

function copyResult() {
  feedback(false);
  navigator.clipboard?.writeText(displayEl.textContent);
  showToast(`Copied ${displayEl.textContent}`);
}

let touchStartX = 0;
const displayArea = document.getElementById('display-area');
displayArea.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
displayArea.addEventListener('touchend', (e) => {
  if (Math.abs(e.changedTouches[0].screenX - touchStartX) > 35) backspace();
}, { passive: true });

const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
function syncThemeColor() {
  document.getElementById('theme-meta').setAttribute('content', darkMedia.matches ? '#000000' : '#f2f2f7');
}
darkMedia.addEventListener('change', syncThemeColor);
syncThemeColor();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

updateDisplay();
