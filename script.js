/**
 * CONFIGURATION & CONSTANTS
 */
const CONFIG = {
  RARITIES: {
    common:    { label: 'Common',    color: '#7a7f8a' },
    uncommon:  { label: 'Uncommon',  color: '#3fbf5a' },
    rare:      { label: 'Rare',      color: '#3a7ccf' },
    epic:      { label: 'Epic',      color: '#8a4faa' },
    legendary: { label: 'Legendary', color: '#e67e22' },
    mythical:  { label: 'Mythical',  color: '#ff0000' }
  },
  SYSTEMS: {
    mothership: {
      label: 'MOTHERSHIP',
      theme: 'theme-mothership',
      files: ['mosh-weapons.json', 'mosh-armor.json', 'mosh-equipment.json'],
      cases: [
        { id: 'm-wep', name: 'Weapon Crate',    color: '#e74c3c', group: 'Standard Issue',  filter: i => i.category === 'weapons' },
        { id: 'm-arm', name: 'Armor Locker',    color: '#3498db', group: 'Standard Issue',  filter: i => i.category === 'armor' },
        { id: 'm-tls', name: 'Utility Kit',     color: '#95a5a6', group: 'Standard Issue',  filter: i => i.category === 'equipment' },
        { id: 'm-med', name: 'Medbay Recovery', color: '#2ecc71', group: 'Special Ops',     filter: i => i.tags?.includes('medical') || i.name.includes('Stim') },
        { id: 'm-sci', name: 'Research Lab',    color: '#9b59b6', group: 'Special Ops',     filter: i => i.rarity === 'mythical' || i.tags?.includes('science') },
        { id: 'm-mil', name: 'Military Deck',   color: '#c0392b', group: 'Special Ops',     filter: i => i.tags?.includes('combat') || i.tags?.includes('heavy') }
      ]
    },
    dnd: {
      label: 'D&D 5E',
      theme: 'theme-dnd',
      files: ['dnd-weapons.json', 'dnd-armor.json', 'dnd-equipment.json'],
      cases: [
        { id: 'd-wep', name: 'The Armory',     color: '#c0392b', group: 'Common Stock', filter: i => i.category === 'weapons' },
        { id: 'd-arm', name: 'The Bulwark',    color: '#2980b9', group: 'Common Stock', filter: i => i.category === 'armor' },
        { id: 'd-vil', name: 'Village Market', color: '#d35400', group: 'Common Stock', filter: i => ['common', 'uncommon'].includes(i.rarity) },
        { id: 'd-dun', name: 'Dungeon Hoard',  color: '#2c3e50', group: 'Rare Finds',   filter: i => i.rarity !== 'common' && (i.tags?.includes('magic') || i.tags?.includes('loot')) },
        { id: 'd-cas', name: 'Royal Treasury', color: '#f1c40f', group: 'Rare Finds',   filter: i => i.cost > 1000 || i.rarity === 'mythical' }
      ]
    }
  }
};

/**
 * APP STATE
 */
class AppState {
  constructor() {
    this.items      = [];
    this.inventory  = [];
    this.activeCase = null;
    this.activeSystem = 'mothership';
    this.isSpinning = false;
    this.rarityFilter = null;
  }

  setSystem(key) {
    this.activeSystem = key;
    this.inventory    = JSON.parse(localStorage.getItem(`inv_${key}`) || '[]');
    this.rarityFilter = null;
  }

  save() {
    localStorage.setItem(`inv_${this.activeSystem}`, JSON.stringify(this.inventory));
  }
}

const state = new AppState();

/**
 * DOM HELPERS
 */
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/**
 * VIEW MANAGEMENT
 */
function showPanel(tabName) {
  $$('.content-panel').forEach(p => { p.hidden = true; });
  $(`#${tabName}Panel`).hidden = false;

  if (tabName === 'main') {
    $('#caseSelectGrid').hidden    = false;
    $('#caseOpenContainer').hidden = true;
    $('#reelWrap').hidden          = true;
  }

  $$('.menu-item').forEach(m => m.classList.toggle('active', m.dataset.tab === tabName));
}

function enterCase() {
  $('#caseSelectGrid').hidden    = true;
  $('#caseOpenContainer').hidden = false;
  $('#reelWrap').hidden          = true;
  $('#openBtn').hidden           = false;
  $('#backBtn').hidden           = false;
}

function exitCase() {
  $('#caseOpenContainer').hidden = true;
  $('#caseSelectGrid').hidden    = false;
  $('#reelWrap').hidden          = true;
}

/**
 * CORE LOGIC
 */
async function loadSystem(key) {
  const sys = CONFIG.SYSTEMS[key];
  if (!sys) return;

  state.setSystem(key);
  document.body.className = sys.theme;
  $('#siteHeader').textContent = sys.label;

  $$('.system-menu-item').forEach(el => {
    el.classList.toggle('active', el.dataset.system === key);
  });

  showPanel('main');

  const data = await Promise.all(sys.files.map(async file => {
    try {
      const r    = await fetch(`./${file}`);
      const json = await r.json();
      const cat  = file.includes('weapon') ? 'weapons'
                 : file.includes('armor')  ? 'armor'
                 : 'equipment';
      const arr  = Array.isArray(json) ? json : (Object.values(json)[0] || []);
      return arr.map(i => ({ ...i, category: cat }));
    } catch (e) { return []; }
  }));

  state.items = autoAssignRarity(data.flat());
  renderAll();
}

function autoAssignRarity(items) {
  const sorted = [...items].sort((a, b) => (parseInt(a.cost) || 0) - (parseInt(b.cost) || 0));
  const tiers  = Object.keys(CONFIG.RARITIES);
  return sorted.map((item, i) => ({
    ...item,
    rarity: tiers[Math.floor((i / sorted.length) * tiers.length)] || 'common'
  }));
}

/**
 * RENDERING
 */
function renderAll() {
  const sys = CONFIG.SYSTEMS[state.activeSystem];

  // Group cases by their group label and render each group with a heading
  const groups = sys.cases.reduce((acc, c) => {
    (acc[c.group] = acc[c.group] || []).push(c);
    return acc;
  }, {});

  $('#caseSelectGrid').innerHTML = Object.entries(groups).map(([groupName, cases]) => `
    <div class="case-group">
      <div class="case-group-title">${groupName}</div>
      <div class="case-select-grid">
        ${cases.map(c => `
          <div class="case-tile" data-id="${c.id}" style="border-color:${c.color}">
            <div class="case-tile-icon" style="background:${c.color}22; border-color:${c.color}">📦</div>
            <div class="case-tile-name">${c.name}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  $('#rarityTabs').innerHTML = Object.keys(CONFIG.RARITIES).map(r => `
    <div class="rarity-tab ${r} ${state.rarityFilter === r ? 'active' : ''}" data-rarity="${r}"></div>
  `).join('');

  renderLoot();
  renderInventory();
}

function renderLoot() {
  const items = state.rarityFilter
    ? state.items.filter(i => i.rarity === state.rarityFilter)
    : state.items;

  if (!items.length) {
    $('#lootContent').innerHTML = '<div class="inv-empty">No items found</div>';
    return;
  }

  $('#lootContent').innerHTML = `<div class="grid-layout">${
    items.map(i => `
      <div class="loot-item">
        ${i.image ? `<div class="loot-item-icon"><img src="${i.image}" alt="${i.name}"></div>` : ''}
        <div class="loot-item-name">${i.name}</div>
        <div class="loot-item-rarity" style="color:${CONFIG.RARITIES[i.rarity].color}">${CONFIG.RARITIES[i.rarity].label}</div>
      </div>
    `).join('')
  }</div>`;
}

function renderInventory() {
  $('#invCount').textContent = `${state.inventory.length} Items`;
  $('#invGrid').innerHTML = state.inventory.map((item, i) => `
    <div class="inv-tile" style="border-color:${CONFIG.RARITIES[item.rarity].color}">
      ${item.image ? `<div class="inv-tile-icon"><img src="${item.image}" alt="${item.name}"></div>` : ''}
      <div class="inv-tile-name">${item.name}</div>
      <div class="inv-tile-rarity" style="color:${CONFIG.RARITIES[item.rarity].color}">${CONFIG.RARITIES[item.rarity].label}</div>
      <button class="inv-del" data-idx="${i}">×</button>
    </div>
  `).join('') || '<div class="inv-empty">Inventory is empty</div>';
}

/**
 * THE SPIN
 */
function spin() {
  if (state.isSpinning) return;

  const pool = state.items.filter(state.activeCase.filter);
  if (!pool.length) { alert('This case is currently empty!'); return; }

  state.isSpinning = true;

  const track     = $('#reelTrack');
  const reelWrap  = $('#reelWrap');
  const reelItems = Array.from({ length: 80 }, () => pool[Math.floor(Math.random() * pool.length)]);

  track.innerHTML = reelItems.map(item => `
    <div class="rc" style="--rc-col:${CONFIG.RARITIES[item.rarity].color}">
      <div class="rc-name">${item.name}</div>
    </div>
  `).join('');

  $('#openBtn').hidden = true;
  $('#backBtn').hidden = true;
  reelWrap.hidden      = false;

  track.style.transition = 'none';
  track.style.transform  = 'translateX(0)';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const cellW    = 120;
    const winnerIdx = 70;
    const offset   = (winnerIdx * cellW) - (reelWrap.offsetWidth / 2 - cellW / 2);
    track.style.transition = 'transform 6s cubic-bezier(0.1, 0, 0.1, 1)';
    track.style.transform  = `translateX(-${offset}px)`;
  }));

  setTimeout(() => {
    const winner = reelItems[70];
    state.inventory.push(winner);
    state.save();
    showSplash(winner);
    state.isSpinning = false;
  }, 6500);
}

function showSplash(item) {
  const splash = document.createElement('div');
  splash.className = 'splash-overlay';
  splash.style.background = CONFIG.RARITIES[item.rarity].color;
  splash.innerHTML = `
    <div class="splash-content">
      <h1>${item.name}</h1>
      <p>${CONFIG.RARITIES[item.rarity].label}</p>
      <small style="opacity: 0.8;">Click to continue</small>
    </div>
  `;
  document.body.appendChild(splash);

  const dismissSplash = () => {
    if (document.body.contains(splash)) {
        splash.remove();
        $('#reelWrap').hidden = true;
        $('#openBtn').hidden  = false;
        $('#backBtn').hidden  = false;
        renderInventory();
    }
  };

  splash.onclick = dismissSplash;
  
  // Auto-dismiss after 5 seconds if the user doesn't click
  setTimeout(dismissSplash, 5000);
}

/**
 * EVENT DELEGATION
 */
document.addEventListener('click', (e) => {
  const t = e.target;

  const tile = t.closest('.case-tile');
  if (tile) {
    state.activeCase = CONFIG.SYSTEMS[state.activeSystem].cases.find(c => c.id === tile.dataset.id);
    enterCase();
    return;
  }

  if (t.id === 'backBtn') {
    exitCase();
    return;
  }

  if (t.id === 'openBtn') {
    spin();
    return;
  }

  const rarityTab = t.closest('.rarity-tab');
  if (rarityTab) {
    const r = rarityTab.dataset.rarity;
    state.rarityFilter = state.rarityFilter === r ? null : r;
    renderAll();
    return;
  }

  const delBtn = t.closest('.inv-del');
  if (delBtn) {
    state.inventory.splice(parseInt(delBtn.dataset.idx), 1);
    state.save();
    renderInventory();
    return;
  }

  const menuItem = t.closest('.menu-item');
  if (menuItem) {
    showPanel(menuItem.dataset.tab);
    $('#menuDropdown').classList.remove('show');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    return;
  }

  const sysItem = t.closest('.system-menu-item');
  if (sysItem) {
    loadSystem(sysItem.dataset.system);
    $('#systemMenu').classList.remove('show');
    return;
  }

  if (!t.closest('#menuDropdown') && !t.closest('#menuBtn')) {
    $('#menuDropdown').classList.remove('show');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
  }
  if (!t.closest('#systemMenu') && !t.closest('#siteHeader')) {
    $('#systemMenu').classList.remove('show');
  }
});

// Primary Menu Toggle (Inventory/Loot/Main)
$('#menuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = $('#menuDropdown');
  menu.classList.toggle('show');
  $('#menuBtn').setAttribute('aria-expanded', menu.classList.contains('show'));
  // Close the system menu if open
  $('#systemMenu').classList.remove('show');
});

// System Selection Toggle (Mothership/D&D)
$('#siteHeader').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#systemMenu').classList.toggle('show');
});

// Initial Boot
loadSystem('mothership');
