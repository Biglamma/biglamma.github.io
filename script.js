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
        // Type-Based Cases
        { id: 'm-wep', name: 'Weapon Crate',   color: '#e74c3c', filter: i => i.category === 'weapons' },
        { id: 'm-arm', name: 'Armor Locker',   color: '#3498db', filter: i => i.category === 'armor' },
        { id: 'm-tls', name: 'Utility Kit',    color: '#95a5a6', filter: i => i.category === 'equipment' },
        // Location-Based Cases
        { id: 'm-med', name: 'Medbay Recovery',color: '#2ecc71', filter: i => i.tags?.includes('medical') || i.name.includes('Stim') },
        { id: 'm-sci', name: 'Research Lab',   color: '#9b59b6', filter: i => i.rarity === 'mythical' || i.tags?.includes('science') },
        { id: 'm-mil', name: 'Military Deck',  color: '#c0392b', filter: i => i.tags?.includes('combat') || i.tags?.includes('heavy') }
      ]
    },
    dnd: {
      label: 'D&D 5E',
      theme: 'theme-dnd',
      files: ['dnd-weapons.json', 'dnd-armor.json', 'dnd-equipment.json'],
      cases: [
        // Type-Based Cases
        { id: 'd-wep', name: 'The Armory',     color: '#c0392b', filter: i => i.category === 'weapons' },
        { id: 'd-arm', name: 'The Bulwark',    color: '#2980b9', filter: i => i.category === 'armor' },
        // Location-Based Cases
        { id: 'd-vil', name: 'Village Market', color: '#d35400', filter: i => ['common', 'uncommon'].includes(i.rarity) },
        { id: 'd-dun', name: 'Dungeon Hoard',  color: '#2c3e50', filter: i => i.rarity !== 'common' && (i.tags?.includes('magic') || i.tags?.includes('loot')) },
        { id: 'd-cas', name: 'Royal Treasury', color: '#f1c40f', filter: i => i.cost > 1000 || i.rarity === 'mythical' }
      ]
    }
  }
};

/**
 * APP STATE MANAGEMENT
 */
class AppState {
  constructor() {
    this.items = [];
    this.inventory = [];
    this.activeCase = null;
    this.activeSystem = 'mothership';
    this.isSpinning = false;
    this.rarityFilter = null;
  }

  setSystem(key) {
    this.activeSystem = key;
    this.inventory = JSON.parse(localStorage.getItem(`inv_${key}`) || '[]');
    this.rarityFilter = null;
  }

  save() {
    localStorage.setItem(`inv_${this.activeSystem}`, JSON.stringify(this.inventory));
  }
}

const state = new AppState();

/**
 * UI HELPERS
 */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const toggleView = (showId) => {
  $$('.content-panel, #caseOpenContainer').forEach(el => el.hidden = true);
  $(`#${showId}`).hidden = false;
};

/**
 * CORE LOGIC
 */
async function loadSystem(key) {
  state.setSystem(key);
  const sys = CONFIG.SYSTEMS[key];
  
  document.body.className = sys.theme;
  $('#siteHeader').textContent = sys.label;

  // DRY: Fetch all files and auto-tag categories
  const data = await Promise.all(sys.files.map(async file => {
    try {
      const r = await fetch(`./${file}`);
      const json = await r.json();
      const cat = file.includes('weapon') ? 'weapons' : file.includes('armor') ? 'armor' : 'equipment';
      return (Array.isArray(json) ? json : Object.values(json)[0]).map(i => ({ ...i, category: cat }));
    } catch (e) { return []; }
  }));

  state.items = autoAssignRarity(data.flat());
  renderAll();
}

function autoAssignRarity(items) {
  const sorted = [...items].sort((a, b) => (parseInt(a.cost) || 0) - (parseInt(b.cost) || 0));
  const tiers = Object.keys(CONFIG.RARITIES);
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
  
  // Render Cases
  $('#caseSelectGrid').innerHTML = sys.cases.map(c => `
    <div class="case-tile" data-id="${c.id}" style="border-color:${c.color}">
      <div style="font-size:2rem; margin-bottom:8px;">📦</div>
      <div>${c.name}</div>
    </div>
  `).join('');

  // Render Rarity Tabs
  $('#rarityTabs').innerHTML = Object.keys(CONFIG.RARITIES).map(r => `
    <div class="rarity-tab ${r} ${state.rarityFilter === r ? 'active' : ''}" data-rarity="${r}"></div>
  `).join('');

  renderLoot();
  renderInventory();
}

function renderLoot() {
  const filtered = state.rarityFilter ? state.items.filter(i => i.rarity === state.rarityFilter) : state.items;
  $('#lootContent').innerHTML = filtered.map(i => `
    <div class="loot-item">
      <div class="loot-item-icon">${i.image ? `<img src="${i.image}">` : '📦'}</div>
      <div class="loot-item-name">${i.name}</div>
      <div style="color:${CONFIG.RARITIES[i.rarity].color}">${CONFIG.RARITIES[i.rarity].label}</div>
    </div>
  `).join('') || '<div class="inv-empty">No items found</div>';
}

function renderInventory() {
  $('#invCount').textContent = `${state.inventory.length} Items`;
  $('#invGrid').innerHTML = state.inventory.map((item, i) => `
    <div class="inv-tile" style="border-color:${CONFIG.RARITIES[item.rarity].color}">
      <div class="inv-tile-icon">${item.image ? `<img src="${item.image}">` : '📦'}</div>
      <div class="inv-tile-name">${item.name}</div>
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
  if (!pool.length) return alert("This case is currently empty!");

  state.isSpinning = true;
  const track = $('#reelTrack');
  const reelItems = Array.from({length: 80}, () => pool[Math.floor(Math.random() * pool.length)]);
  
  track.innerHTML = reelItems.map(item => `
    <div class="rc" style="--rc-col:${CONFIG.RARITIES[item.rarity].color}">
      <div class="rc-name">${item.name}</div>
    </div>
  `).join('');

  $('#openBtn').hidden = $('#backBtn').hidden = true;
  $('#reelWrap').hidden = false;
  track.style.transition = 'none';
  track.style.transform = 'translateX(0)';
  
  setTimeout(() => {
    track.style.transition = 'transform 6s cubic-bezier(0.1, 0, 0.1, 1)';
    track.style.transform = `translateX(-${(70 * 120) - ($('#reelWrap').offsetWidth/2 - 60)}px)`;
  }, 50);

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
  splash.innerHTML = `<div class="splash-content"><h1>${item.name}</h1><p>${CONFIG.RARITIES[item.rarity].label}</p></div>`;
  document.body.appendChild(splash);
  
  splash.onclick = () => {
    splash.remove();
    $('#openBtn').hidden = $('#backBtn').hidden = false;
    $('#reelWrap').hidden = true;
    renderInventory();
  };
}

/**
 * GLOBAL EVENT DELEGATION
 */
document.addEventListener('click', (e) => {
  const t = e.target;

  if (t.closest('.case-tile')) {
    const id = t.closest('.case-tile').dataset.id;
    state.activeCase = CONFIG.SYSTEMS[state.activeSystem].cases.find(c => c.id === id);
    toggleView('caseOpenContainer');
    $('#caseSelectGrid').hidden = true;
  }

  if (t.id === 'backBtn') {
    toggleView('mainPanel');
    $('#caseSelectGrid').hidden = false;
  }

  if (t.id === 'openBtn') spin();

  if (t.closest('.rarity-tab')) {
    const r = t.closest('.rarity-tab').dataset.rarity;
    state.rarityFilter = state.rarityFilter === r ? null : r;
    renderAll();
  }

  if (t.closest('.inv-del')) {
    state.inventory.splice(t.closest('.inv-del').dataset.idx, 1);
    state.save();
    renderInventory();
  }

  if (t.closest('.menu-item')) {
    const tab = t.closest('.menu-item').dataset.tab;
    toggleView(`${tab}Panel`);
    $('#menuDropdown').hidden = true;
  }

  if (t.closest('.system-menu-item')) {
    loadSystem(t.closest('.system-menu-item').dataset.system);
    $('#systemMenu').classList.remove('show');
  }
});

// Setup Menus
$('#menuBtn').onclick = () => $('#menuDropdown').hidden = !$('#menuDropdown').hidden;
$('#siteHeader').onclick = () => $('#systemMenu').classList.toggle('show');

// Start
loadSystem('mothership');
