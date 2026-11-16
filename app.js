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

// ==========================================
// 315+ SECRET CODES ENGINE
// ==========================================
const secretStyle = document.createElement('style');
document.head.appendChild(secretStyle);
let reflexTimer = null;
let reflexStart = 0;

// 1. Theme Palette Generator (Codes 100 - 159 + Iconic Theme Codes)
const THEME_CODES = {
  '1999': ['IMPERIUM GOLD', '#d4af37', '#f5d76e'],
  '2077': ['CYBERPUNK NEON', '#ff007f', '#00f5d4'],
  '007':  ['STEALTH GREEN', '#00c853', '#00ff41'],
  '666':  ['DEVIL CRIMSON', '#d50000', '#ff1744'],
  '100': ['ROYAL BLUE', '#0a84ff', '#64d2ff'],
  '101': ['EMERALD MINT', '#30d158', '#a8ff78'],
  '102': ['ULTRA VIOLET', '#bf5af2', '#e0aaff'],
  '103': ['SOLAR FLARE', '#ff3b30', '#ff9f0a'],
  '104': ['ARCTIC ICE', '#5ac8fa', '#e0fbfc'],
  '105': ['ROSE GOLD', '#ff2d55', '#ffb3c1'],
  '106': ['TOXIC LIME', '#aacc00', '#d4d700'],
  '107': ['MIDNIGHT INDIGO', '#5e5ce6', '#a29bfe'],
  '108': ['SAFFRON SPIRIT', '#ff6d00', '#ffab40'],
  '109': ['PLATINUM SILVER', '#8e8e93', '#e5e5ea'],
  '110': ['COBALT ELECTRIC', '#2979ff', '#82b1ff'],
  '111': ['ANGEL AURA', '#ffd60a', '#fff3b0'],
  '112': ['CRIMSON SAMURAI', '#c1121f', '#fdf0d5'],
  '113': ['DEEP OCEAN', '#0077b6', '#90e0ef'],
  '114': ['SAKURA BLOSSOM', '#ff758f', '#ffccd5'],
  '115': ['SUNSET CORAL', '#ff6b6b', '#ffe66d'],
  '116': ['MINT FROST', '#06d6a0', '#b8f2e6'],
  '117': ['SPARTAN ARMOR', '#556b2f', '#bdb76b'],
  '118': ['AMETHYST ROYAL', '#7b2cbf', '#c77dff'],
  '119': ['LAVA MAGMA', '#e85d04', '#faa307'],
  '120': ['ELECTRIC TEAL', '#00b4d8', '#caf0f8'],
  '121': ['GOLDEN SAND', '#ca6702', '#ee9b00'],
  '122': ['NEON ORCHID', '#f72585', '#b5179e'],
  '123': ['FOREST PINE', '#2d6a4f', '#95d5b2'],
  '124': ['CHAMPAGNE LUXE', '#b08968', '#ede0d4'],
  '125': ['LASER LEMON', '#d9ed92', '#b5e48c'],
  '126': ['COPPER BRONZE', '#bc6c25', '#dda15e'],
  '127': ['HYPER CYAN', '#00bbf9', '#00f5d4'],
  '128': ['VELVET PLUM', '#9d4edd', '#e0aaff'],
  '129': ['RUBY FLAME', '#d90429', '#ef233c'],
  '130': ['TITANIUM GRAY', '#6c757d', '#dee2e6'],
  '131': ['JADE EMPEROR', '#1b4332', '#74c69d'],
  '132': ['MANGO TANGO', '#fb8500', '#ffb703'],
  '133': ['COSMIC PURPLE', '#3a0ca3', '#4cc9f0'],
  '134': ['PEACH NECTAR', '#f28482', '#f5cac3'],
  '135': ['MATRIX PHOSPHOR', '#008000', '#38b000'],
  '136': ['NORDIC SKY', '#457b9d', '#a8dadc'],
  '137': ['AMBER GLOW', '#f48c06', '#ffba08'],
  '138': ['MAGENTA PULSE', '#ff006e', '#ffbe0b'],
  '139': ['TURQUOISE BAY', '#2ec4b6', '#cbf3f0'],
  '140': ['OBSIDIAN GOLD', '#9e7b2f', '#ffd166'],
  '141': ['CHERRY BOMB', '#9b2226', '#ae2012'],
  '142': ['GLACIER BLUE', '#48cae4', '#ade8f4'],
  '143': ['LOVE CRIMSON', '#ff4d6d', '#ff8fa3'],
  '144': ['SACRED LOTUS', '#c77dff', '#f3c4fb'],
  '145': ['BRONZE TITAN', '#7f4f24', '#a68a64'],
  '146': ['VOLT YELLOW', '#ccff00', '#e0ff4f'],
  '147': ['ROYAL INDIGO', '#3f37c9', '#4895ef'],
  '148': ['CORAL REEF', '#f3722c', '#f9c74f'],
  '149': ['AQUA MARINE', '#43aa8b', '#90be6d'],
  '150': ['SUPREME GOLD', '#ffb703', '#ffd166']
};

// 2. Constants, Mindset, Angel Numbers & Pop-Culture Codes (200+ codes)
const MESSAGE_CODES = {
  '314': ['PI CONSTANT', '3.14159265'],
  '1618': ['GOLDEN RATIO (PHI)', '1.61803398'],
  '2718': ['EULER NUMBER (e)', '2.71828182'],
  '1414': ['SQRT OF 2', '1.41421356'],
  '1732': ['SQRT OF 3', '1.73205080'],
  '299792': ['SPEED OF LIGHT (km/s)', '299,792'],
  '1729': ['RAMANUJAN HARDY NO.', '1729'],
  '6174': ['KAPREKAR CONSTANT', '6174'],
  '42': ['MEANING OF LIFE', '42'],
  '369': ['TESLA KEY TO UNIVERSE', '3 - 6 - 9'],
  '786': ['BLESSING & PEACE', '786'],
  '222': ['ANGEL 222: BALANCE', 'ALIGNED'],
  '333': ['ANGEL 333: GROWTH', 'EXPANDING'],
  '444': ['ANGEL 444: PROTECTION', 'SHIELDED'],
  '555': ['ANGEL 555: BIG CHANGE', 'EVOLVING'],
  '888': ['ANGEL 888: ABUNDANCE', 'PROSPERITY'],
  '999': ['ANGEL 999: COMPLETION', 'NEXT LEVEL'],
  '1010': ['10:10 NEW CHAPTER', 'FOCUS'],
  '1111': ['11:11 MAKE A WISH', 'LOCKED IN'],
  '1212': ['12:12 STAY DISCIPLINED', 'EXECUTE'],
  '2222': ['22:22 MASTER BUILDER', 'DOMINATE'],
  '2408': ['LEGEND BIRTHDAY', '24 AUG'],
  '2026': ['CURRENT YEAR', '2026'],
  '420': ['CHILL MODE', 'RELAX'],
  '808': ['TR-808 BASS DROP', 'BOOM'],
  '911': ['EMERGENCY MODE', '911'],
  '500': ['SERVER OVERLOAD', '500 ERR'],
  '403': ['ACCESS FORBIDDEN', 'DENIED'],
  '200': ['STATUS OK', '200 OK']
};

// Auto-generate Codes 201 to 420 (Mindset, Leverage, Tech & Fun Presets)
const EXTRA_QUOTES = [
  'SILENCE IS POWER', 'STAY DANGEROUS', 'ZERO EXCUSES', 'PURE LEVERAGE', 'SELF COMMAND',
  'OUTWORK EVERYONE', 'LASER FOCUS', 'COLD DISCIPLINE', 'BUILD IN SILENCE', 'NO MERCY',
  'APEX MINDSET', 'BEHAVIORAL GRAVITY', 'OWN YOUR TIME', 'HIGH VALUE ONLY', 'UNSTOPPABLE',
  'CALCULATED RISK', 'SHARP EDGE', 'IRON WILL', 'MASTER YOUR CRAFT', 'NEXT MOVE WIN',
  'STAY HUNGRY', 'ELITE STANDARD', 'ZERO DISTRACTION', 'DEEP WORK', 'CASHFLOW KING',
  'ASYMMETRIC BET', 'LONG TERM GAME', 'SILENT KILLER', 'PRECISION FIRST', 'NO LIMITS',
  'FEARLESS MIND', 'RELENTLESS', 'ALPHA STATE', 'MENTAL FORTRESS', 'CONTROL THE ROOM',
  'STRATEGIC PATIENCE', 'POWER MOVE', 'HIGH CONVICTION', 'EXECUTE NOW', 'PURE CLARITY'
];

for (let i = 201; i <= 420; i++) {
  const codeStr = String(i);
  if (!MESSAGE_CODES[codeStr]) {
    const quote = EXTRA_QUOTES[(i - 201) % EXTRA_QUOTES.length];
    MESSAGE_CODES[codeStr] = [`CODE #${codeStr}`, quote];
  }
}

function openCodeDirectory() {
  const modal = document.getElementById('history-modal');
  const list = document.getElementById('history-list');
  const allEntries = [
    ['0999', 'Open This Master Secret Codebook'],
    ['0000', 'Reset Default iOS Theme'],
    ['0011', 'Reflex Speed Test Mini-Game'],
    ['1234', 'Hidden Private Calculator Vault'],
    ['777', 'Lucky Slot Spin / Decision Maker'],
    ['8888', 'Matrix Digital Rain (5 sec)'],
    ['9999', 'Hacker Digit Scramble Override'],
    ['80085', 'Flip Calculator Upside Down'],
    ['5555', 'Boss / Panic Mode (Fake GST)'],
    ['404', 'Error 404 Prank'],
    ['0501', 'Coin Flip (HEADS / TAILS)'],
    ['0502', 'Roll 6-Sided Dice (1-6)'],
    ['0503', 'Generate 6-Digit Secret PIN'],
    ['0504', 'Current Live Clock Time'],
    ['0505', 'Current Screen & Device Info'],
    ...Object.entries(THEME_CODES).map(([k, v]) => [k, `Theme: ${v[0]}`]),
    ...Object.entries(MESSAGE_CODES).map(([k, v]) => [k, `${v[0]} → ${v[1]}`])
  ];

  list.innerHTML = `<p style="color:var(--op-bg);font-size:13px;text-align:center;padding:6px 0;">Total Secret Codes Active: ${allEntries.length} (Type code + =)</p>` +
    allEntries.map(([code, desc]) => `
      <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;text-align:left;" onclick="toggleHistory(false);secretBuffer='${code}';equal();">
        <strong style="font-size:18px;color:var(--op-bg);">${code}</strong>
        <small style="font-size:13px;">${desc}</small>
      </div>
    `).join('');
  modal.classList.add('open');
}

function triggerSecretCode(code) {
  if (reflexTimer === 'ready') {
    const ms = Math.round(performance.now() - reflexStart);
    reflexTimer = null;
    displayEl.style.color = '';
    exprEl.textContent = 'REFLEX SPEED';
    displayEl.textContent = `${ms} ms`;
    val = '0';
    return true;
  }

  // Open Master Codebook (0999 + =)
  if (code.endsWith('0999')) {
    openCodeDirectory();
    return true;
  }

  // Reset Theme (0000 + =)
  if (code.endsWith('0000')) {
    secretStyle.textContent = '';
    exprEl.textContent = '';
    displayEl.style.color = '';
    showToast('Default Theme Restored');
    updateDisplay();
    return true;
  }

  // Reflex Mini-Game (0011 + =)
  if (code.endsWith('0011')) {
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

  // Private Vault (1234 + =)
  if (code.endsWith('1234')) {
    const savedNote = localStorage.getItem('ios_calc_vault') || '';
    const updated = prompt('Private Calculator Vault:', savedNote);
    if (updated !== null) {
      localStorage.setItem('ios_calc_vault', updated);
      showToast('Vault Saved');
    }
    return true;
  }

  // Lucky Slot / Decision Maker (777 + =)
  if (code.endsWith('777')) {
    let spins = 0;
    const outcomes = ['7-7-7 WIN', 'YES ✓', 'NO ✕', 'DO IT NOW'];
    const slot = setInterval(() => {
      displayEl.textContent = Math.floor(100 + Math.random() * 899);
      spins++;
      if (spins > 18) {
        clearInterval(slot);
        exprEl.textContent = 'LUCKY SPIN';
        displayEl.textContent = outcomes[Math.floor(Math.random() * outcomes.length)];
        val = '0';
      }
    }, 60);
    return true;
  }

  // Matrix Rain (8888 + =)
  if (code.endsWith('8888')) {
    const chars = '01アイウエオカキクケコ79';
    let frames = 0;
    exprEl.textContent = 'MATRIX CONNECTED';
    const matrix = setInterval(() => {
      let line = '';
      for (let i = 0; i < 11; i++) line += chars[Math.floor(Math.random() * chars.length)];
      displayEl.style.color = '#00ff41';
      displayEl.textContent = line;
      frames++;
      if (frames > 45) {
        clearInterval(matrix);
        displayEl.style.color = '';
        exprEl.textContent = '';
        val = '0';
        updateDisplay();
      }
    }, 75);
    return true;
  }

  // Hacker Override (9999 + =)
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

  // Flip Screen (80085 + =)
  if (code.endsWith('80085')) {
    const appEl = document.querySelector('.app');
    appEl.style.transition = 'transform 0.6s ease';
    appEl.style.transform = 'rotate(180deg)';
    setTimeout(() => { appEl.style.transform = 'rotate(0deg)'; }, 4000);
    return true;
  }

  // Boss Panic Mode (5555 + =)
  if (code.endsWith('5555')) {
    secretStyle.textContent = '';
    displayEl.style.color = '';
    exprEl.textContent = '25,000 × 18% GST =';
    val = '4500';
    updateDisplay();
    return true;
  }

  // Error 404 Prank (404 + =)
  if (code.endsWith('404')) {
    exprEl.textContent = 'ERROR 404';
    displayEl.textContent = 'NO BRAIN';
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
    val = '0';
    return true;
  }

  // Live Utility Codes (0501 - 0505)
  if (code.endsWith('0501')) {
    exprEl.textContent = 'COIN FLIP';
    displayEl.textContent = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
    val = '0';
    return true;
  }
  if (code.endsWith('0502')) {
    exprEl.textContent = 'DICE ROLL';
    displayEl.textContent = String(Math.floor(Math.random() * 6) + 1);
    val = '0';
    return true;
  }
  if (code.endsWith('0503')) {
    exprEl.textContent = 'RANDOM 6-DIGIT PIN';
    displayEl.textContent = String(Math.floor(100000 + Math.random() * 900000));
    val = '0';
    return true;
  }
  if (code.endsWith('0504')) {
    const now = new Date();
    exprEl.textContent = now.toDateString().toUpperCase();
    displayEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    val = '0';
    return true;
  }
  if (code.endsWith('0505')) {
    exprEl.textContent = 'VIEWPORT RESOLUTION';
    displayEl.textContent = `${window.innerWidth}×${window.innerHeight}`;
    val = '0';
    return true;
  }

  // Check 55 Theme Codes
  for (const [key, [name, opColor, textColor]] of Object.entries(THEME_CODES)) {
    if (code === key || (key.length >= 3 && code.endsWith(key))) {
      secretStyle.textContent = `:root { --op-bg: ${opColor} !important; } #display { color: ${textColor}; }`;
      exprEl.textContent = `${name} UNLOCKED`;
      showToast(name);
      return true;
    }
  }

  // Check 245+ Message, Constant & Mindset Codes
  for (const [key, [title, msg]] of Object.entries(MESSAGE_CODES)) {
    if (code === key || (key.length >= 3 && code.endsWith(key))) {
      exprEl.textContent = title;
      displayEl.style.fontSize = msg.length > 9 ? '44px' : '64px';
      displayEl.textContent = msg;
      val = '0';
      return true;
    }
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
