// ------------------------------------------------------------
// RARITIES
// ------------------------------------------------------------

const RARITIES = {
  common:    { label: 'Common',    color: '#7a7f8a', icon: '⬜' },
  uncommon:  { label: 'Uncommon',  color: '#3fbf5a', icon: '🟩' },
  rare:      { label: 'Rare',      color: '#3a7ccf', icon: '🟦' },
  epic:      { label: 'Epic',      color: '#8a4faa', icon: '🟪' },
  legendary: { label: 'Legendary', color: '#e67e22', icon: '🟧' }
};

// ------------------------------------------------------------
// CASES
// ------------------------------------------------------------

const CASES = [
  { id: 'c1', name: 'Teamster Cache',   icon: '📦', color: '#7a7f8a', pool: ['common','uncommon'] },
  { id: 'c2', name: 'Corp Requisition', icon: '🗃️', color: '#3fbf5a', pool: ['common','uncommon','rare'] },
  { id: 'c3', name: 'Marine Armory',    icon: '💼', color: '#3a7ccf', pool: ['uncommon','rare','epic'] },
  { id: 'c4', name: 'Black Budget',     icon: '🎖️', color: '#e67e22', pool: ['rare','epic','legendary'] }
];

// ------------------------------------------------------------
// GLOBALS
// ------------------------------------------------------------

let ITEMS = [];
let activeCase = CASES[0];
let spinning = false;
let inventory = JSON.parse(localStorage.getItem("inventory") || "[]");

// ------------------------------------------------------------
// JSON LOADING + COST PARSING + AUTO RARITY ASSIGNMENT
// ------------------------------------------------------------

async function loadAllItems() {
  try {
    const [weapons, armor, equipment] = await Promise.all([
      fetch("./weapons.json").then(r => r.json()),
      fetch("./armor.json").then(r => r.json()),
      fetch("./equipment.json").then(r => r.json())
    ]);

    return [
      ...weapons.weapons,
      ...armor.armor,
      ...equipment.tools
    ];
  } catch (err) {
    console.error("JSON load failed:", err);
    return [];
  }
}

function parseCost(cost) {
  if (!cost) return 0;
  if (cost === "Free") return 0;
  if (cost.endsWith("kcr")) return parseFloat(cost) * 1000;
  if (cost.endsWith("cr")) return parseInt(cost);
  return 0;
}

function autoAssignRarities(items) {
  const sorted = [...items].sort((a, b) => parseCost(a.cost) - parseCost(b.cost));
  const n = sorted.length;

  sorted.forEach((item, i) => {
    const p = i / n;

    if (p < 0.20) item.rarity = "common";
    else if (p < 0.40) item.rarity = "uncommon";
    else if (p < 0.60) item.rarity = "rare";
    else if (p < 0.80) item.rarity = "epic";
    else item.rarity = "legendary";
  });

  return sorted;
}

async function initItems() {
  const all = await loadAllItems();

  if (!all.length) {
    console.error("No items loaded — reel cannot be built.");
    return;
  }

  ITEMS = autoAssignRarities(all);

  renderLootPanel();
  renderCaseNav();
  buildReel();
  updateInventory();
}

// ------------------------------------------------------------
// IMAGE FALLBACK
// ------------------------------------------------------------

function imgOrEmoji(item) {
  const rar = RARITIES[item.rarity];
  if (!item.image) return rar.icon;

  return `<img src="${item.image}" alt="" onerror="this.onerror=null; this.replaceWith('${rar.icon}')">`;
}

// ------------------------------------------------------------
// AUTO-DETECT CELL WIDTH (fixes misalignment)
// ------------------------------------------------------------

function getCellWidth() {
  const temp = document.createElement('div');
  temp.className = 'rc';
  temp.style.visibility = 'hidden';
  temp.innerHTML = '<div class="rc-icon">X</div>';
  document.body.appendChild(temp);
  const w = temp.getBoundingClientRect().width;
  temp.remove();
  return w;
}

// ------------------------------------------------------------
// MENU
// ------------------------------------------------------------

document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('menuDropdown').classList.toggle('show');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#menuBtn') && !e.target.closest('.menu-dropdown')) {
    document.getElementById('menuDropdown').classList.remove('show');
  }
});

// ------------------------------------------------------------
// TABS
// ------------------------------------------------------------

function switchTab(tab) {
  document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(tab + 'Panel').classList.add('active');

  document.querySelectorAll('.menu-item').forEach(m => {
    m.classList.toggle('active', m.dataset.tab === tab);
  });

  if (tab === 'loot') renderLootPanel();
}

document.querySelectorAll('.menu-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ------------------------------------------------------------
// LOOT PANEL
// ------------------------------------------------------------

function renderLootPanel() {
  const content = document.getElementById('lootContent');
  if (!ITEMS.length) return;

  let html = '';

  Object.entries(RARITIES).forEach(([key, rar]) => {
    const items = ITEMS.filter(i => i.rarity === key);
    html += `
      <div class="loot-group">
        <div class="loot-group-title">
          <div class="loot-group-col" style="background:${rar.color}"></div>
          ${rar.label}
        </div>
        <div class="loot-items">
          ${items.map(i => `<div class="loot-item">${imgOrEmoji(i)} ${i.name}</div>`).join('')}
        </div>
      </div>`;
  });

  content.innerHTML = html;
}

// ------------------------------------------------------------
// CASE NAV
// ------------------------------------------------------------

function renderCaseNav() {
  const nav = document.getElementById('caseNav');

  nav.innerHTML = CASES.map(c => `
    <button class="case-tab ${c.id === activeCase.id ? 'active' : ''}"
      style="--case-col:${c.color}"
      data-case="${c.id}">
      <span class="case-icon">${c.icon}</span>
      <span>${c.name}</span>
    </button>
  `).join('');

  nav.querySelectorAll('.case-tab').forEach(btn => {
    btn.addEventListener('click', () => selectCase(btn.dataset.case));
  });
}

function selectCase(id) {
  activeCase = CASES.find(c => c.id === id);
  document.getElementById('openBtnIcon').textContent = activeCase.icon;
  renderCaseNav();
  buildReel();
}

// ------------------------------------------------------------
// ITEM PICKING
// ------------------------------------------------------------

const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1
};

function weightedRandomRarity(pool) {
  // Build weighted list only from allowed rarities
  const entries = pool.map(r => ({
    rarity: r,
    weight: RARITY_WEIGHTS[r]
  }));

  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;

  for (const e of entries) {
    if (roll < e.weight) return e.rarity;
    roll -= e.weight;
  }

  return entries[entries.length - 1].rarity;
}


function pickItem(pool) {
  // Step 1: choose rarity based on weights
  const chosenRarity = weightedRandomRarity(pool);

  // Step 2: pick a random item from that rarity
  const candidates = ITEMS.filter(i => i.rarity === chosenRarity);

  return candidates[Math.floor(Math.random() * candidates.length)];
}


function makeReelCell(item) {
  const rar = RARITIES[item.rarity];
  const div = document.createElement('div');
  div.className = 'rc';
  div.style.setProperty('--rc-col', rar.color);
  div.innerHTML = `
    <div class="rc-icon">${imgOrEmoji(item)}</div>
    <div class="rc-name">${item.name}</div>
    <div class="rc-bar"></div>`;
  return div;
}

// ------------------------------------------------------------
// REEL
// ------------------------------------------------------------

function buildReel() {
  if (!ITEMS.length) return;

  const track = document.getElementById('reelTrack');
  track.style.transition = 'none';
  track.style.transform = 'translateX(0)';
  track.innerHTML = '';

  const cells = [];

  for (let i = 0; i < 70; i++) {
    const item = pickItem(activeCase.pool);
    cells.push(item);
    track.appendChild(makeReelCell(item));
  }

  track._cells = cells;
}

// ------------------------------------------------------------
// OPENING FLOW
// ------------------------------------------------------------

document.getElementById('openBtn').addEventListener('click', openBox);

function openBox() {
  if (spinning || !ITEMS.length) return;

  const openBtn = document.getElementById('openBtn');
  const reelWrap = document.getElementById('reelWrap');
  const resultPanel = document.getElementById('resultPanel');

  openBtn.style.display = 'none';
  resultPanel.style.display = 'none';
  resultPanel.classList.remove('show');

  reelWrap.style.display = 'block';
  reelWrap.classList.add('show');

  setTimeout(spin, 500);
}

// ------------------------------------------------------------
// SPIN
// ------------------------------------------------------------

function spin() {
  spinning = true;

  const reelWrap = document.getElementById('reelWrap');
  const track = document.getElementById('reelTrack');

  buildReel();

  const cells = track._cells;
  const CELL_W = getCellWidth();
  const wrapW = reelWrap.offsetWidth;
  const center = wrapW / 2;

  const targetIdx = 40 + Math.floor(Math.random() * 20);
  const targetCenter = targetIdx * CELL_W + CELL_W / 2;
  const finalX = -(targetCenter - center);

  void track.offsetWidth;

  const dur = 6000 + Math.random() * 4000;

  track.style.transition = `transform ${dur}ms cubic-bezier(0.08, 0.92, 0.22, 1.0)`;
  track.style.transform = `translateX(${finalX}px)`;

  setTimeout(() => {
    const won = cells[targetIdx];
    showResult(won);
    addToInventory(won);
    spinning = false;
  }, dur + 200);
}

// ------------------------------------------------------------
// RESULT PANEL
// ------------------------------------------------------------

function showResult(item) {
  const rar = RARITIES[item.rarity];
  const col = rar.color;

  const panel = document.getElementById('resultPanel');

  document.getElementById('resultStripe').style.background = col;
  document.getElementById('resultGlow').style.background = `radial-gradient(circle, ${col} 0%, transparent 70%)`;
  document.getElementById('resultRarity').textContent = rar.label;
  document.getElementById('resultRarity').style.color = col;
  document.getElementById('resultName').textContent = item.name;
  document.getElementById('resultIcon').innerHTML = imgOrEmoji(item);
  document.getElementById('resultDesc').textContent = 'Item acquired and added to inventory.';

  panel.style.display = 'block';
  panel.classList.add('show');

  const delay = {
    common: 1200,
    uncommon: 1500,
    rare: 1800,
    epic: 2200,
    legendary: 2600
  }[item.rarity] || 1500;

  setTimeout(() => {
    panel.classList.remove('show');
    panel.style.display = 'none';

    const reelWrap = document.getElementById('reelWrap');
    reelWrap.classList.remove('show');
    reelWrap.style.display = 'none';

    const openBtn = document.getElementById('openBtn');
    openBtn.style.display = 'flex';
  }, delay);
}

// ------------------------------------------------------------
// INVENTORY
// ------------------------------------------------------------

function addToInventory(item) {
  const invItem = { ...item, id: Date.now() + Math.random() };
  inventory.unshift(invItem);
  saveInventory();
  updateInventory();
}

function saveInventory() {
  localStorage.setItem("inventory", JSON.stringify(inventory));
}

function updateInventory() {
  const grid = document.getElementById('invGrid');

  if (!inventory.length) {
    grid.innerHTML = '<div class="inv-empty">No items yet</div>';
    return;
  }

  grid.innerHTML = inventory.map(item => {
    const rar = RARITIES[item.rarity];
    return `
      <div class="inv-item" style="--rarity-col:${rar.color}" data-id="${item.id}">
        <button class="delete-x">×</button>
        <div class="inv-icon">${imgOrEmoji(item)}</div>
        <div class="inv-name">${item.name}</div>
        <div class="inv-rar">${rar.label}</div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.delete-x').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = Number(btn.closest('.inv-item').dataset.id);
      removeFromInventory(id);
    });
  });
}

function removeFromInventory(id) {
  inventory = inventory.filter(i => i.id !== id);
  saveInventory();
  updateInventory();
}

// ------------------------------------------------------------
// INIT — waits for DOM + JSON
// ------------------------------------------------------------

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM ready — loading items...");

  await initItems();
  switchTab('main');

  console.log("Initialization complete.");
});
