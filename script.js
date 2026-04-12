/**
 * SUPPLY DROP - Single File Version
 * All modules consolidated into one file
 */

// ============================================================================
// DATA & CONSTANTS
// ============================================================================

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

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

class AppState {
  constructor() {
    this.items = [];
    this.activeCase = null;
    this.activeRarityFilter = null;
    this.spinning = false;
    this.inventory = JSON.parse(localStorage.getItem("inventory") || "[]");
    this._observers = {
      inventoryChanged: [],
      caseChanged: [],
      spinningChanged: [],
      rarityFilterChanged: []
    };
  }

  subscribe(event, callback) {
    if (this._observers[event]) this._observers[event].push(callback);
  }

  _notify(event, data) {
    if (this._observers[event]) {
      this._observers[event].forEach(cb => cb(data));
    }
  }

  setItems(items) { this.items = items; }
  setActiveCase(caseObj) { this.activeCase = caseObj; this._notify('caseChanged', caseObj); }
  toggleRarityFilter(rarity) { this.activeRarityFilter = this.activeRarityFilter === rarity ? null : rarity; this._notify('rarityFilterChanged', this.activeRarityFilter); }
  setSpinning(value) { this.spinning = value; this._notify('spinningChanged', value); }
  addToInventory(item) { this.inventory.push(item); this.saveInventory(); this._notify('inventoryChanged', this.inventory); }
  removeFromInventory(index) { this.inventory.splice(index, 1); this.saveInventory(); this._notify('inventoryChanged', this.inventory); }
  saveInventory() { localStorage.setItem("inventory", JSON.stringify(this.inventory)); }
  clearInventory() { this.inventory = []; this.saveInventory(); this._notify('inventoryChanged', this.inventory); }
}

const state = new AppState();

// ============================================================================
// ITEMS MODULE
// ============================================================================

async function loadAllItems() {
  try {
    const [weapons, armor, equipment] = await Promise.all([
      fetch("./weapons.json").then(r => r.json()),
      fetch("./armor.json").then(r => r.json()),
      fetch("./equipment.json").then(r => r.json())
    ]);
    return [
      ...weapons.weapons.map(w => ({ ...w, category: 'weapons' })),
      ...armor.armor.map(a => ({ ...a, category: 'armor' })),
      ...equipment.tools.map(e => ({ ...e, category: 'equipment' }))
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
    if (!item.tags) item.tags = [];
  });
  return sorted;
}

// ============================================================================
// UI HELPERS
// ============================================================================

function querySelector(selector) { return document.querySelector(selector); }
function querySelectorAll(selector) { return document.querySelectorAll(selector); }
function hideElement(el) { el.style.display = 'none'; }
function showElement(el, display = 'block') { el.style.display = display; }
function toggleClass(el, className, force) { el.classList.toggle(className, force); }

function addEventDelegation(parent, eventType, selector, handler) {
  parent.addEventListener(eventType, (e) => {
    const target = e.target.closest(selector);
    if (target) handler.call(target, e);
  });
}

function imgOrEmoji(item) {
  if (!item.image) return '';
  return `<img src="${item.image}" alt="" onerror="this.onerror=null; this.replaceWith('')">`;
}

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

// ============================================================================
// REEL/SPINNING
// ============================================================================

const SPIN_CONFIG = {
  minDuration: 10000,    // 10 seconds
  maxDuration: 15000,    // 15 seconds
  easing: 'cubic-bezier(0.08, 0.92, 0.22, 1.0)',
  cellCount: 140,
  winWindow: 20
};

function buildReel() {
  if (!state.items.length) return;
  const track = querySelector('#reelTrack');
  track.style.transition = 'none';
  track.style.transform = 'translateX(0)';
  track.innerHTML = '';
  const cells = [];
  for (let i = 0; i < SPIN_CONFIG.cellCount; i++) {
    const item = pickItem(state.activeCase.pool);
    cells.push(item);
    track.appendChild(makeReelCell(item));
  }
  track._cells = cells;
}

function pickItem(pool) {
  const candidates = state.items.filter(i => pool.includes(i.rarity));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function makeReelCell(item) {
  const rar = RARITIES[item.rarity];
  const div = document.createElement('div');
  div.className = 'rc';
  div.style.setProperty('--rc-col', rar.color);
  const cellSize = 120; // Match CSS
  div.style.width = cellSize + 'px';
  div.style.height = cellSize + 'px';
  div.innerHTML = `<div class="rc-icon">${imgOrEmoji(item)}</div><div class="rc-name">${item.name}</div>`;
  return div;
}

function spin() {
  state.setSpinning(true);
  const openBtn = querySelector('#openBtn');
  const backBtn = querySelector('#backBtn');
  const reelWrap = querySelector('#reelWrap');
  const track = querySelector('#reelTrack');
  
  // Hide buttons during spin
  hideElement(openBtn);
  hideElement(backBtn);
  showElement(reelWrap, 'block');

  buildReel();

  const cells = track._cells;
  const CELL_W = 120; // Match CSS
  const wrapW = reelWrap.offsetWidth;
  const center = wrapW / 2;

  const centerIdx = Math.floor(cells.length / 2);
  const offset = Math.floor(SPIN_CONFIG.winWindow / 2);
  const targetIdx = centerIdx - offset + Math.floor(Math.random() * SPIN_CONFIG.winWindow);
  
  const targetCenter = targetIdx * CELL_W + CELL_W / 2;
  const finalX = -(targetCenter - center);

  void track.offsetWidth;

  const dur = SPIN_CONFIG.minDuration + Math.random() * (SPIN_CONFIG.maxDuration - SPIN_CONFIG.minDuration);

  track.style.transition = `transform ${dur}ms ${SPIN_CONFIG.easing}`;
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
  
  // Create splash overlay
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
  
  // Animate in
  setTimeout(() => splash.classList.add('show'), 10);
  
  // Remove after 5 seconds and show buttons again
  setTimeout(() => {
    splash.classList.remove('show');
    setTimeout(() => {
      splash.remove();
      showElement(querySelector('#openBtn'));
      showElement(querySelector('#backBtn'));
      hideElement(querySelector('#reelWrap'));
      updateInventory();
    }, 300);
  }, 5000);
}

// ============================================================================
// INVENTORY
// ============================================================================

function updateInventory() {
  const grid = querySelector('#invGrid');
  const count = querySelector('#invCount');
  
  if (count) {
    count.textContent = state.inventory.length + ' item' + (state.inventory.length !== 1 ? 's' : '');
  }
  
  if (!state.inventory.length) {
    grid.innerHTML = '<div class="inv-empty">No items yet</div>';
    return;
  }

  let html = '';
  
  // Group inventory by category
  const byCategory = {
    weapons: [],
    armor: [],
    equipment: []
  };
  
  state.inventory.forEach((item, idx) => {
    item._invIndex = idx; // Store index for deletion
    if (byCategory[item.category]) {
      byCategory[item.category].push(item);
    }
  });

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
  
  // Attach delete handlers
  addEventDelegation(grid, 'click', '.inv-tile-delete', function() {
    const idx = parseInt(this.dataset.index);
    state.removeFromInventory(idx);
    updateInventory();
  });
}

// ============================================================================
// CASES
// ============================================================================

function renderCaseTiles() {
  const grid = querySelector('#caseSelectGrid');
  grid.innerHTML = CASES.map(c => `<div class="case-tile" data-case="${c.id}" style="border-color:${c.color}"><div style="font-size:20px; margin-bottom:6px;">📦</div><div>${c.name}</div></div>`).join('');
  addEventDelegation(grid, 'click', '.case-tile', function() {
    const id = this.dataset.case;
    state.setActiveCase(CASES.find(c => c.id === id));
    enterCaseOpening();
  });
}

function enterCaseOpening() {
  hideElement(querySelector('#caseSelectGrid'));
  querySelector('#caseOpenContainer').classList.add('active');
  showElement(querySelector('#openBtn'));
  showElement(querySelector('#backBtn'));
  hideElement(querySelector('#reelWrap'));
}

function exitCaseOpening() {
  showElement(querySelector('#caseSelectGrid'), 'grid');
  querySelector('#caseOpenContainer').classList.remove('active');
}

// ============================================================================
// LOOT TABLE
// ============================================================================

function renderLootRarityTabs() {
  const container = querySelector('#rarityTabs');
  container.innerHTML = RARITY_ORDER.map(r => `<div class="rarity-tab ${r} ${state.activeRarityFilter === r ? 'active' : ''}" data-rarity="${r}"></div>`).join('');
  addEventDelegation(container, 'click', '.rarity-tab', function() {
    state.toggleRarityFilter(this.dataset.rarity);
    renderLootRarityTabs();
    renderLootPanel();
  });
}

function renderLootPanel() {
  const content = querySelector('#lootContent');
  if (!state.items.length) return;
  let html = '';
  
  Object.entries(ITEM_CATEGORIES).forEach(([catKey, cat]) => {
    let items = state.items.filter(i => i.category === catKey);
    if (state.activeRarityFilter) {
      items = items.filter(i => i.rarity === state.activeRarityFilter);
    }
    if (!items.length) return;
    items = items.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    html += `<div class="loot-category-section"><div class="loot-category-header">${cat.label}</div><div class="loot-items-list">${items.map(i => {
      const rar = RARITIES[i.rarity];
      return `<div class="loot-item"><div class="loot-item-icon">${imgOrEmoji(i)}</div><div class="loot-item-name">${i.name}</div><div class="loot-item-rarity" style="color:${rar.color}">${rar.label}</div></div>`;
    }).join('')}</div></div>`;
  });
  if (!html) html = '<div style="padding:40px; text-align:center; color: var(--dim);">No items found</div>';
  content.innerHTML = html;
}

// ============================================================================
// NAVIGATION
// ============================================================================

function switchTab(tab) {
  querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
  querySelector(tab + 'Panel').classList.add('active');
  querySelectorAll('.menu-item').forEach(m => m.classList.toggle('active', m.dataset.tab === tab));
  if (tab === 'loot') {
    renderLootPanel();
    renderLootRarityTabs();
  }
  hideElement(querySelector('#menuDropdown'));
}

function setupMenu() {
  querySelector('#menuBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleClass(querySelector('#menuDropdown'), 'show');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menuBtn') && !e.target.closest('#menuDropdown')) {
      querySelector('#menuDropdown').classList.remove('show');
    }
  });
  
  querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      switchTab(tab);
    });
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initApp() {
  const all = await loadAllItems();
  if (!all.length) {
    console.warn("No items loaded");
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

function setupEventHandlers() {
  querySelector('#openBtn').addEventListener('click', handleOpenCase);
  querySelector('#backBtn').addEventListener('click', exitCaseOpening);
}

function handleOpenCase() {
  if (state.spinning || !state.items.length) return;
  const openBtn = querySelector('#openBtn');
  const reelWrap = querySelector('#reelWrap');
  const resultPanel = querySelector('#resultPanel');
  hideElement(openBtn);
  hideElement(resultPanel);
  resultPanel.classList.remove('show');
  showElement(reelWrap, 'block');
  reelWrap.classList.add('show');
  setTimeout(spin, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}