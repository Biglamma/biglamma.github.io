// CONSTANTS

const RARITIES = {
  common:    { label: 'Common',    color: '#7a7f8a' },
  uncommon:  { label: 'Uncommon',  color: '#3fbf5a' },
  rare:      { label: 'Rare',      color: '#3a7ccf' },
  epic:      { label: 'Epic',      color: '#8a4faa' },
  legendary: { label: 'Legendary', color: '#e67e22' },
  mythical:  { label: 'Mythical',  color: '#ff0000' }
};

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];

const ITEM_CATEGORIES = {
  weapons:   { label: 'Weapons' },
  armor:     { label: 'Armor' },
  equipment: { label: 'Equipment' }
};

const CASES = [
  { id: 'c1', name: 'Teamster Cache',   color: '#7a7f8a', pool: ['common','uncommon'] },
  { id: 'c2', name: 'Corp Requisition', color: '#3fbf5a', pool: ['common','uncommon','rare'] },
  { id: 'c3', name: 'Marine Armory',    color: '#3a7ccf', pool: ['uncommon','rare','epic'] },
  { id: 'c4', name: 'Black Budget',     color: '#e67e22', pool: ['rare','epic','legendary'] }
];

// STATE

class AppState {
  constructor() {
    this.items = [];
    this.activeCase = null;
    this.activeRarityFilter = null;
    this.spinning = false;
    this.inventory = JSON.parse(localStorage.getItem("inventory") || "[]");
  }

  setItems(items) { this.items = items; }
  setActiveCase(caseObj) { this.activeCase = caseObj; }
  toggleRarityFilter(rarity) { this.activeRarityFilter = this.activeRarityFilter === rarity ? null : rarity; }
  setSpinning(value) { this.spinning = value; }
  addToInventory(item) { this.inventory.push(item); localStorage.setItem("inventory", JSON.stringify(this.inventory)); }
  removeFromInventory(index) { this.inventory.splice(index, 1); localStorage.setItem("inventory", JSON.stringify(this.inventory)); }
}

const state = new AppState();

// LOAD ITEMS

async function loadAllItems() {
  try {
    const [weaponsData, armorData, equipmentData] = await Promise.all([
      fetch("./weapons.json").then(r => r.json()).catch(() => ({ weapons: [] })),
      fetch("./armor.json").then(r => r.json()).catch(() => ({ armor: [] })),
      fetch("./equipment.json").then(r => r.json()).catch(() => ({ tools: [] }))
    ]);

    const weapons = Array.isArray(weaponsData) ? weaponsData : (weaponsData.weapons || []);
    const armor = Array.isArray(armorData) ? armorData : (armorData.armor || []);
    const equipment = Array.isArray(equipmentData) ? equipmentData : (equipmentData.tools || equipmentData.equipment || []);

    return [
      ...weapons.map(w => ({ ...w, category: 'weapons' })),
      ...armor.map(a => ({ ...a, category: 'armor' })),
      ...equipment.map(e => ({ ...e, category: 'equipment' }))
    ];
  } catch (err) {
    console.error("JSON load failed:", err);
    return [];
  }
}

function parseCost(cost) {
  if (cost === undefined || cost === null) return 0;
  if (typeof cost === 'number') return cost;
  
  const strCost = String(cost).trim().toLowerCase();
  if (strCost === "free") return 0;
  if (strCost.endsWith("kcr")) return parseFloat(strCost) * 1000;
  if (strCost.endsWith("cr")) return parseInt(strCost) || 0;
  
  return parseFloat(strCost) || 0;
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
    else if (p < 0.95) item.rarity = "legendary";
    else item.rarity = "mythical";
    if (!item.tags) item.tags = [];
  });
  return sorted;
}

// DOM HELPERS

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const hide = (el) => el.style.display = 'none';
const show = (el, display = 'block') => el.style.display = display;

function imgOrEmoji(item) {
  if (!item.image) return '';
  return `<img src="${item.image}" alt="" onerror="this.onerror=null; this.replaceWith('')">`;
}

// RENDER CASES

function renderCaseTiles() {
  const grid = $('#caseSelectGrid');
  grid.innerHTML = CASES.map(c => 
    `<div class="case-tile" data-case="${c.id}" style="border-color:${c.color}">
      <div style="font-size:20px; margin-bottom:6px;">📦</div>
      <div>${c.name}</div>
    </div>`
  ).join('');
}

function enterCaseOpening() {
  hide($('#caseSelectGrid'));
  $('#caseOpenContainer').classList.add('active');
  show($('#openBtn'));
  show($('#backBtn'));
  hide($('#reelWrap'));
}

function exitCaseOpening() {
  show($('#caseSelectGrid'), 'grid');
  $('#caseOpenContainer').classList.remove('active');
}

// REEL / SPINNING

function buildReel() {
  const track = $('#reelTrack');
  track.style.transition = 'none';
  track.style.transform = 'translateX(0)';
  track.innerHTML = '';
  
  const cells = [];
  for (let i = 0; i < 140; i++) {
    const pool = state.activeCase.pool;
    const candidates = state.items.filter(item => pool.includes(item.rarity));

    const fallbackCandidates = candidates.length > 0 ? candidates : state.items;
    const item = fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
    
    cells.push(item);
    
    const rar = RARITIES[item.rarity];
    const div = document.createElement('div');
    div.className = 'rc';
    div.style.setProperty('--rc-col', rar.color);
    div.innerHTML = `
      <div class="rc-icon">${imgOrEmoji(item)}</div>
      <div class="rc-name">${item.name}</div>
    `;
    track.appendChild(div);
  }
  track._cells = cells;
}

function spin() {
  state.setSpinning(true);
  
  const openBtn = $('#openBtn');
  const backBtn = $('#backBtn');
  const reelWrap = $('#reelWrap');
  const track = $('#reelTrack');
  
  hide(openBtn);
  hide(backBtn);
  show(reelWrap, 'block');

  buildReel();

  const cells = track._cells;
  const CELL_W = 120;
  const wrapW = reelWrap.offsetWidth;
  const center = wrapW / 2;

  const centerIdx = Math.floor(cells.length / 2);
  const targetIdx = centerIdx - 10 + Math.floor(Math.random() * 20);
  const targetCenter = targetIdx * CELL_W + CELL_W / 2;
  const finalX = -(targetCenter - center);

  void track.offsetWidth;

  const dur = 10000 + Math.random() * 5000;

  track.style.transition = `transform ${dur}ms cubic-bezier(0.08, 0.92, 0.22, 1.0)`;
  track.style.transform = `translateX(${finalX}px)`;

  setTimeout(() => {
    const won = cells[targetIdx];
    showSplash(won);
    state.addToInventory(won);
    state.setSpinning(false);
  }, dur + 200);
}

function showSplash(item) {
  const rar = RARITIES[item.rarity];
  
  const splash = document.createElement('div');
  splash.className = 'splash-overlay';
  splash.style.background = rar.color;
  splash.innerHTML = `
    <div class="splash-content">
      <div class="splash-icon">${imgOrEmoji(item)}</div>
      <div class="splash-name">${item.name}</div>
      <div class="splash-rarity">${rar.label}</div>
    </div>
  `;
  
  document.body.appendChild(splash);
  
  setTimeout(() => splash.classList.add('show'), 10);

  let closed = false;
  function closeSplash() {
    if (closed) return;
    closed = true;
    splash.classList.remove('show');
    setTimeout(() => {
      splash.remove();
      show($('#openBtn'));
      show($('#backBtn'));
      hide($('#reelWrap'));
      updateInventory();
    }, 300);
  }

  splash.addEventListener('click', closeSplash, { once: true });
  setTimeout(closeSplash, 2000);
}

// INVENTORY

function updateInventory() {
  const grid = $('#invGrid');
  const count = $('#invCount');
  
  if (count) {
    count.textContent = state.inventory.length + ' item' + (state.inventory.length !== 1 ? 's' : '');
  }
  
  if (!state.inventory.length) {
    grid.innerHTML = '<div class="inv-empty">No items yet</div>';
    return;
  }

  const byCategory = { weapons: [], armor: [], equipment: [] };
  
  state.inventory.forEach((item, idx) => {
    item._invIndex = idx;
    if (byCategory[item.category]) {
      byCategory[item.category].push(item);
    }
  });

  let html = '';
  Object.entries(byCategory).forEach(([catKey, items]) => {
    if (items.length === 0) return;
    const cat = ITEM_CATEGORIES[catKey];
    
    html += `<div class="inv-category">
      <div class="inv-category-header">${cat.label}</div>
      <div class="inv-items-grid">`;
    
    items.forEach(item => {
      const rar = RARITIES[item.rarity];
      html += `<div class="inv-tile" style="border-color:${rar.color}">
        <div class="inv-tile-icon">${imgOrEmoji(item)}</div>
        <div class="inv-tile-name">${item.name}</div>
        <div class="inv-tile-rarity" style="color:${rar.color}">${rar.label}</div>
        <button class="inv-tile-delete" data-index="${item._invIndex}">×</button>
      </div>`;
    });
    
    html += `</div></div>`;
  });

  grid.innerHTML = html;
}

// LOOT TABLE

function renderLootRarityTabs() {
  const container = $('#rarityTabs');
  container.innerHTML = RARITY_ORDER.map(r => 
    `<div class="rarity-tab ${r} ${state.activeRarityFilter === r ? 'active' : ''}" data-rarity="${r}"></div>`
  ).join('');
}

function renderLootPanel() {
  const content = $('#lootContent');
  if (!state.items.length) return;
  
  let html = '';
  
  Object.entries(ITEM_CATEGORIES).forEach(([catKey, cat]) => {
    let items = state.items.filter(i => i.category === catKey);
    if (state.activeRarityFilter) {
      items = items.filter(i => i.rarity === state.activeRarityFilter);
    }
    if (!items.length) return;
    
    items = items.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    
    html += `<div class="loot-category-section">
      <div class="loot-category-header">${cat.label}</div>
      <div class="loot-items-list">`;
    
    items.forEach(i => {
      const rar = RARITIES[i.rarity];
      html += `<div class="loot-item">
        <div class="loot-item-icon">${imgOrEmoji(i)}</div>
        <div class="loot-item-name">${i.name}</div>
        <div class="loot-item-rarity" style="color:${rar.color}">${rar.label}</div>
      </div>`;
    });
    
    html += `</div></div>`;
  });
  
  if (!html) html = '<div style="padding:40px; text-align:center; color: var(--dim);">No items found</div>';
  content.innerHTML = html;
}

// MENU & TABS

function setupMenu() {
  const menuBtn = $('#menuBtn');
  const menuDropdown = $('#menuDropdown');
  
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('show');
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menuBtn') && !e.target.closest('#menuDropdown')) {
      menuDropdown.classList.remove('show');
    }
  });
  
  $$('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.dataset.tab);
      menuDropdown.classList.remove('show');
    });
  });
}

function switchTab(tab) {
  $$('.content-panel').forEach(p => p.classList.remove('active'));
  $(`#${tab}Panel`).classList.add('active');
  
  $$('.menu-item').forEach(m => {
    m.classList.toggle('active', m.dataset.tab === tab);
  });
}

// EVENT HANDLERS

function setupEventHandlers() {
  // Case Opening Controls
  $('#openBtn').addEventListener('click', () => {
    if (state.spinning || !state.items.length) return;
    spin();
  });
  
  $('#backBtn').addEventListener('click', () => {
    exitCaseOpening();
  });

  // Case Selection Grid
  $('#caseSelectGrid').addEventListener('click', (e) => {
    const tile = e.target.closest('.case-tile');
    if (tile) {
      const caseId = tile.dataset.case;
      state.setActiveCase(CASES.find(c => c.id === caseId));
      enterCaseOpening();
    }
  });

  // Inventory Deletion
  $('#invGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.inv-tile-delete');
    if (btn) {
      const idx = parseInt(btn.dataset.index);
      state.removeFromInventory(idx);
      updateInventory();
    }
  });

  // Loot Rarity Filtering Tabs
  $('#rarityTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.rarity-tab');
    if (tab) {
      state.toggleRarityFilter(tab.dataset.rarity);
      renderLootRarityTabs();
      renderLootPanel();
    }
  });
}

// INIT

async function init() {
  const all = await loadAllItems();
  if (!all.length) {
    console.warn("No items loaded - verify your JSON files exist and are being served via a local web server (CORS).");
    return;
  }
  
  const items = autoAssignRarities(all);
  state.setItems(items);
  
  renderCaseTiles();
  updateInventory();
  renderLootPanel();
  renderLootRarityTabs();
  setupMenu();
  setupEventHandlers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
