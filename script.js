// This is for the reel cell width — must stay in sync with .rc { min-width } in CSS
const REEL_CELL_W = 140;

// This is for all static configuration: rarities and game systems with their stash definitions
const CONFIG = {
  RARITIES: {
    common:    { label: 'Common',    color: '#7a7f8a', weight: 0.5000 },
    uncommon:  { label: 'Uncommon',  color: '#3fbf5a', weight: 0.3000 },
    rare:      { label: 'Rare',      color: '#3a7ccf', weight: 0.2000 },
    epic:      { label: 'Epic',      color: '#8a4faa', weight: 0.1000 },
    legendary: { label: 'Legendary', color: '#e67e22', weight: 0.0500 },
    mythical:  { label: 'Magical', color: '#ff0000', weight: 0.0100 },
  },
  SYSTEMS: {
    mothership: {
      label: 'MOTHERSHIP',
      theme: 'theme-mothership',
      files: ['mosh-weapons.json', 'mosh-armor.json', 'mosh-equipment.json'],
      cases: [
        { id: 'm-wep', name: 'Arsenal',  color: '#e74c3c', group: 'Standard Issue', filter: i => i.category === 'weapons'   },
        { id: 'm-arm', name: 'Aegis',  color: '#3498db', group: 'Standard Issue', filter: i => i.category === 'armor'     },
        { id: 'm-eqp', name: 'Logistics',      color: '#95a5a6', group: 'Standard Issue', filter: i => i.category === 'equipment' },
        
        { id: 'm-med', name: 'Medbay Cache',  color: '#2ecc71', group: 'Scavenged Finds',    filter: i => i.tags?.includes('medical') || i.name?.includes('Stim') },
        { id: 'm-sci', name: 'Research Lab',  color: '#9b59b6', group: 'Scavenged Finds',    filter: i => i.rarity === 'mythical'    || i.tags?.includes('science') },
        { id: 'm-mil', name: 'Military Deck', color: '#c0392b', group: 'Scavenged Finds',    filter: i => i.tags?.includes('combat') || i.tags?.includes('heavy')  },
      ],
    },
    dnd: {
      label: 'D&D 5E',
      theme: 'theme-dnd',
      files: ['dnd-weapons.json', 'dnd-armor.json', 'dnd-equipment.json'],
      magicFiles: ['dnd-magic-items.json'],
      cases: [
        { id: 'd-wep', name: 'Armory',      color: '#c0392b', group: 'Adventuring Gear', filter: i => i.category === 'weapons'  },
        { id: 'd-arm', name: 'Bulwark',     color: '#2980b9', group: 'Adventuring Gear', filter: i => i.category === 'armor'    },
        { id: 'd-eqp', name: "Provisions", color: '#7f8c8d', group: 'Adventuring Gear', filter: i => i.category === 'equipment'     },
        
        { id: 'd-wiz', name: "Wizard's Bag",    color: '#8e44ad', group: 'Recovered Spoils',  filter: i => i.tags?.includes('magic') || i.rarity === 'epic'       },
        { id: 'd-dun', name: 'Dungeon Hoard',   color: '#34495e', group: 'Recovered Spoils',  filter: i => i.rarity !== 'common'    && (i.tags?.includes('magic') || i.tags?.includes('loot')) },
        { id: 'd-nob', name: 'Noble Treasury',  color: '#d4ac0d', group: 'Recovered Spoils',  filter: i => i.cost > 500             || i.rarity === 'legendary'   },
        { id: 'd-roy', name: 'Royal Vault',     color: '#f1c40f', group: 'Recovered Spoils',  filter: i => i.cost > 1000            || i.rarity === 'mythical'    },
        { id: 'd-test', name: 'Cocksure Mythic', color: '#ff0000', group: 'Experimental', filter: i => i.rarity === 'mythical' }, // Test case for the 0.1% roll
      ],
    },
  },
};

// This is for all runtime state: items, inventory, disabled items, active stash, filters, and UI selection
class AppState {
  constructor() {
    this.items          = [];
    this.magicPool      = []; // Holds secret items
    this.inventory      = [];
    this.disabledItems  = new Set();
    this.activeCase     = null;
    this.activeSystem   = 'mothership';
    this.isSpinning     = false;
    this.rarityFilter   = null;
    this.selectedInvIdx = null;
  }

  setSystem(key) {
    this.activeSystem   = key;
    this.magicPool      = [];
    this.inventory      = JSON.parse(localStorage.getItem(`inv_${key}`) || '[]');
    this.disabledItems  = new Set(JSON.parse(localStorage.getItem(`dis_${key}`) || '[]'));
    this.rarityFilter   = null;
    this.selectedInvIdx = null;
  }

  saveInventory() {
    localStorage.setItem(`inv_${this.activeSystem}`, JSON.stringify(this.inventory));
  }

  saveDisabled() {
    localStorage.setItem(`dis_${this.activeSystem}`, JSON.stringify([...this.disabledItems]));
  }

  toggleDisabled(key) {
    this.disabledItems.has(key) ? this.disabledItems.delete(key) : this.disabledItems.add(key);
    this.saveDisabled();
  }
}

const state = new AppState();

// This is for concise DOM selection helpers used throughout
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// WEIGHTED SELECTION HELPER
function getWeightedItem(pool) {
  const totalWeight = pool.reduce((sum, item) => sum + (CONFIG.RARITIES[item.rarity]?.weight || 0), 0);
  let random = Math.random() * totalWeight;

  for (const item of pool) {
    const itemWeight = CONFIG.RARITIES[item.rarity].weight;
    if (random < itemWeight) return item;
    random -= itemWeight;
  }
  return pool[pool.length - 1] || pool[0];
}

// This is for switching the active panel and syncing nav button states
function showPanel(name) {
  $$('.content-panel').forEach(p => { p.hidden = true; });
  $(`#${name}Panel`).hidden = false;
  $$('.menu-item').forEach(m => m.classList.toggle('active', m.dataset.tab === name));
  state.selectedInvIdx = null;
}

// This is for transitioning into the reel view when a stash tile is tapped
function enterCase(caseConfig) {
  state.activeCase      = caseConfig;
  state.selectedInvIdx  = null;
  $('#caseGroups').hidden        = true;
  $('#caseOpenContainer').hidden = false;
  $('#reelWrap').hidden          = true;
  $('#openBtn').hidden           = false;
  $('#backBtn').hidden           = false;
}

// This is for returning from the reel view back to the stash selection grid
function exitCase() {
  state.activeCase = null;
  $('#caseGroups').hidden        = false;
  $('#caseOpenContainer').hidden = true;
  $('#reelWrap').hidden          = true;
}

// This is for fetching a system's JSON files, tagging each item with its category, and kicking off a full render
async function loadSystem(key) {
  const sys = CONFIG.SYSTEMS[key];
  if (!sys) return;

  state.setSystem(key);
  document.body.className      = sys.theme;
  $('#siteHeader').textContent = sys.label;

  $$('.system-menu-item').forEach(el =>
    el.classList.toggle('active', el.dataset.system === key)
  );

  showPanel('main');
  exitCase();

  // Load Standard Items
  const batches = await Promise.all(sys.files.map(async file => {
    try {
      const res  = await fetch(`./${file}`);
      const json = await res.json();
      const cat  = file.includes('weapon') ? 'weapons'
                 : file.includes('armor')  ? 'armor'
                 : 'equipment';
      const arr  = Array.isArray(json) ? json : (Object.values(json)[0] || []);
      return arr.map(i => ({ ...i, category: cat }));
    } catch { return []; }
  }));

  state.items = autoAssignRarity(batches.flat());

  // Load Magic/Secret Items
  if (sys.magicFiles) {
  const magicBatches = await Promise.all(sys.magicFiles.map(async file => {
    try {
      const res = await fetch(`./${file}`);
      const json = await res.json();
      
      // FIX: Check specifically for the 'artifacts' key or fallback to array
      const arr = json.artifacts || (Array.isArray(json) ? json : Object.values(json)[0]);
      
      return arr;
    } catch (err) { 
      console.error("Failed to load magic file:", file, err);
      return []; 
    }
  }));

  // Map and store in the magic pool
  state.magicPool = magicBatches.flat().map(i => ({ 
    ...i, 
    rarity: 'legendary', // Visual color for the reel
    category: 'equipment', // Default category for inventory grouping
    _key: i.name 
  }));

  renderAll();
}

// This is for sorting items by cost and spreading rarity tiers via price percentiles
function autoAssignRarity(items) {
  const sorted = [...items].sort((a, b) => (parseInt(a.cost) || 0) - (parseInt(b.cost) || 0));
  const total = sorted.length;

  return sorted.map((item, index) => {
    const percentile = index / total;
    let rarity = 'common';

    if (percentile >= 0.95)      rarity = 'legendary'; 
    else if (percentile >= 0.80) rarity = 'epic';
    else if (percentile >= 0.60) rarity = 'rare';
    else if (percentile >= 0.30) rarity = 'uncommon';
    else                         rarity = 'common';

    return {
      ...item,
      _key:   item.name,
      rarity: rarity
    };
  });
}

// This is for building a titled category section with a responsive item grid — shared by loot and inventory
function renderSection(title, items, renderItemFn) {
  if (!items.length) return '';
  return `
    <div class="cat-section">
      <div class="cat-title">${title}</div>
      <div class="item-grid">${items.map(renderItemFn).join('')}</div>
    </div>
  `;
}

// This is for re-rendering every dynamic region of the page
function renderAll() {
  renderCases();
  renderRarityTabs();
  renderLoot();
  renderInventory();
}

// This is for rendering the stash selection grid, grouped into labelled sections with accent-coloured tiles
function renderCases() {
  const sys    = CONFIG.SYSTEMS[state.activeSystem];
  const groups = sys.cases.reduce((acc, c) => {
    (acc[c.group] = acc[c.group] || []).push(c);
    return acc;
  }, {});

  $('#caseGroups').innerHTML = Object.entries(groups).map(([title, cases]) => `
    <div class="case-group">
      <div class="case-group-title">${title}</div>
      <div class="case-grid">
        ${cases.map(c => `
          <div class="case-tile" data-id="${c.id}" style="border-color:${c.color}">
            <div class="case-tile-icon" style="background:${c.color}1a; border-color:${c.color}">📦</div>
            <div class="case-tile-name">${c.name}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// This is for rendering the large, touch-friendly rarity filter strip above the loot table
function renderRarityTabs() {
  const entries = [['', { label: 'All', color: 'var(--dim)' }], ...Object.entries(CONFIG.RARITIES)];

  $('#rarityTabs').innerHTML = entries.map(([key, r]) => {
    const active = key === '' ? state.rarityFilter === null : state.rarityFilter === key;
    return `
      <button class="rarity-tab" data-rarity="${key}"
        style="border-color:${r.color}; background:${active ? r.color : 'transparent'}; color:${active ? '#fff' : r.color}">
        ${r.label}
      </button>
    `;
  }).join('');
}

// This is for rendering the full item pool split by category, with tap-to-disable toggling on each item
function renderLoot() {
  const visible = state.rarityFilter
    ? state.items.filter(i => i.rarity === state.rarityFilter)
    : state.items;

  const CATS = { weapons: 'Weapons', armor: 'Armor', equipment: 'Tools & Equipment' };

  const html = Object.entries(CATS).map(([cat, label]) =>
    renderSection(label, visible.filter(i => i.category === cat), item => {
      const disabled = state.disabledItems.has(item._key);
      const col      = CONFIG.RARITIES[item.rarity].color;
      return `
        <div class="loot-item${disabled ? ' disabled' : ''}" data-key="${item._key}" style="border-color:${col}">
          ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
          <div class="item-name">${item.name}</div>
          <div class="item-rarity" style="color:${col}">${CONFIG.RARITIES[item.rarity].label}</div>
          ${disabled ? '<div class="excluded-badge">Excluded</div>' : ''}
        </div>
      `;
    })
  ).join('');

  $('#lootContent').innerHTML = html || '<div class="empty-state">No items match this filter</div>';
}

// This is for rendering the inventory grouped by category, with a tap-to-select then confirm-delete flow
function renderInventory() {
  $('#invCount').textContent = `${state.inventory.length} Items`;

  const CATS = { weapons: 'Weapons', armor: 'Armor', equipment: 'Tools & Equipment' };

  const html = Object.entries(CATS).map(([cat, label]) =>
    renderSection(label, state.inventory.filter(i => i.category === cat), item => {
      const idx      = state.inventory.indexOf(item);
      const selected = state.selectedInvIdx === idx;
      const col      = CONFIG.RARITIES[item.rarity]?.color ?? '#7a7f8a';
      return `
        <div class="inv-tile${selected ? ' selected' : ''}" data-inv-idx="${idx}" style="border-color:${col}">
          ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
          <div class="item-name">${item.name}</div>
          <div class="item-rarity" style="color:${col}">${CONFIG.RARITIES[item.rarity]?.label ?? ''}</div>
          <div class="inv-del-overlay" data-del-idx="${idx}">REMOVE</div>
        </div>
      `;
    })
  ).join('');

  $('#invContent').innerHTML = html || '<div class="empty-state">Inventory is empty — start rolling!</div>';
}

// This is for running the reel animation and selecting a random winner from the enabled stash pool
// Updated spin function to handle nested magic rolls
function spin(forcedPool = null) {
  if (state.isSpinning && !forcedPool) return;

  // Use the magicPool if this is a re-roll, otherwise calculate the standard pool
  const isMagicRespin = !!forcedPool;
  const pool = forcedPool || state.items
    .filter(state.activeCase.filter)
    .filter(i => !state.disabledItems.has(i._key));

  if (!pool.length && state.activeCase.id !== 'd-test') {
    alert('No items available to roll!');
    return;
  }

  // Only add the trigger to the pool if we aren't already in the magic reel
  if (!isMagicRespin) {
    pool.push({ name: "MAGIC ROLL", rarity: "mythical", isTrigger: true, _key: "trigger" });
  }

  state.isSpinning = true;

  const track = $('#reelTrack');
  const reelWrap = $('#reelWrap');
  
  // Fill the reel
  const reelItems = Array.from({ length: 80 }, () => getWeightedItem(pool));

  track.innerHTML = reelItems.map(item => `
    <div class="rc" style="--rc-col:${CONFIG.RARITIES[item.rarity].color}">
      ${item.image ? `<img class="rc-img" src="${item.image}" alt="${item.name}">` : ''}
      <div class="rc-name">${item.name}</div>
      ${isMagicRespin ? '<div class="magic-sparkle">✨</div>' : ''}
    </div>
  `).join('');

  $('#openBtn').hidden = true;
  $('#backBtn').hidden = true;
  reelWrap.hidden = false;

  // Reset track position for the animation
  track.style.transition = 'none';
  track.style.transform = 'translateX(0)';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const winnerIdx = 70;
    const offset = (winnerIdx * REEL_CELL_W) - (reelWrap.offsetWidth / 2 - REEL_CELL_W / 2);
    // Speed up the magic roll slightly for hype (5s vs 6s)
    track.style.transition = `transform ${isMagicRespin ? '5s' : '6s'} cubic-bezier(0.1, 0, 0.1, 1)`;
    track.style.transform = `translateX(-${offset}px)`;
  }));

  setTimeout(() => {
    const winner = { ...reelItems[70] };
    
    if (winner.isTrigger) {
      // PHASE 2: The Respin
      if (!state.magicPool.length) {
        alert("The weave is empty!");
        state.isSpinning = false;
        exitCase();
      } else {
        // Trigger the magic respin with the special pool
        spin(state.magicPool); 
      }
    } else {
      // FINAL WIN (Normal or Magic)
      state.inventory.push(winner);
      state.saveInventory();
      state.isSpinning = false;
      showSplash(winner, isMagicRespin); 
    }
  }, isMagicRespin ? 5500 : 6500);
}

// This is for displaying the full-screen item reveal overlay after the reel settles
function showSplash(item, isMagic = false) {
  const col    = isMagic ? CONFIG.RARITIES.mythical.color : CONFIG.RARITIES[item.rarity].color;
  const splash = document.createElement('div');
  splash.className = 'splash-overlay';
  splash.innerHTML = `
    <div class="splash-content" style="border-color:${col}">
      ${item.image ? `<img class="splash-img" src="${item.image}" alt="${item.name}">` : ''}
      <div class="splash-rarity" style="color:${col}">${isMagic ? '✨ ANCIENT MAGIC ✨' : CONFIG.RARITIES[item.rarity].label}</div>
      <h1 class="splash-name" style="color:${col}">${item.name}</h1>
      <div class="splash-hint">Tap anywhere to continue</div>
    </div>
  `;
  document.body.appendChild(splash);

  const dismiss = () => {
    if (!document.body.contains(splash)) return;
    splash.remove();
    $('#reelWrap').hidden = true;
    $('#openBtn').hidden  = false;
    $('#backBtn').hidden  = false;
    renderInventory();
  };

  splash.addEventListener('click', dismiss);
  setTimeout(dismiss, 5000);
}

// This is for handling every user interaction through a single delegated click listener
document.addEventListener('click', e => {
  const t = e.target;

  // This is for stash tile taps that enter the reel view
  const tile = t.closest('.case-tile');
  if (tile) {
    const c = CONFIG.SYSTEMS[state.activeSystem].cases.find(c => c.id === tile.dataset.id);
    if (c) enterCase(c);
    return;
  }

  // This is for the back button returning to stash selection
  if (t.id === 'backBtn') { exitCase(); return; }

  // This is for the open button triggering a spin
  if (t.id === 'openBtn') { spin(); return; }

  // This is for the inventory delete overlay confirming removal on second tap
  const delOverlay = t.closest('.inv-del-overlay');
  if (delOverlay) {
    const idx = parseInt(delOverlay.dataset.delIdx);
    state.inventory.splice(idx, 1);
    state.saveInventory();
    state.selectedInvIdx = null;
    renderInventory();
    return;
  }

  // This is for tapping an inventory tile to reveal or hide its delete overlay
  const invTile = t.closest('.inv-tile');
  if (invTile) {
    const idx = parseInt(invTile.dataset.invIdx);
    state.selectedInvIdx = state.selectedInvIdx === idx ? null : idx;
    renderInventory();
    return;
  }

  // This is for tapping a loot item to toggle it in or out of the roll pool
  const lootItem = t.closest('.loot-item');
  if (lootItem) {
    state.toggleDisabled(lootItem.dataset.key);
    renderLoot();
    return;
  }

  // This is for the rarity filter tabs narrowing the loot table view
  const rarityTab = t.closest('.rarity-tab');
  if (rarityTab) {
    const r = rarityTab.dataset.rarity;
    state.rarityFilter = (r && state.rarityFilter !== r) ? r : null;
    renderRarityTabs();
    renderLoot();
    return;
  }

  // This is for nav menu items switching the visible panel
  const menuItem = t.closest('.menu-item');
  if (menuItem) {
    showPanel(menuItem.dataset.tab);
    $('#menuDropdown').classList.remove('show');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    return;
  }

  // This is for system switcher items loading a different game system
  const sysItem = t.closest('.system-menu-item');
  if (sysItem) {
    loadSystem(sysItem.dataset.system);
    $('#systemMenu').classList.remove('show');
    return;
  }

  // This is for closing open dropdowns and clearing inventory selection on outside clicks
  if (!t.closest('#menuDropdown') && !t.closest('#menuBtn')) {
    $('#menuDropdown').classList.remove('show');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
  }
  if (!t.closest('#systemMenu') && !t.closest('#siteHeader')) {
    $('#systemMenu').classList.remove('show');
  }
  if (!t.closest('.inv-tile') && state.selectedInvIdx !== null) {
    state.selectedInvIdx = null;
    renderInventory();
  }
});

// This is for the hamburger button toggling the navigation dropdown
$('#menuBtn').addEventListener('click', e => {
  e.stopPropagation();
  const menu = $('#menuDropdown');
  menu.classList.toggle('show');
  $('#menuBtn').setAttribute('aria-expanded', menu.classList.contains('show'));
  $('#systemMenu').classList.remove('show');
});

// This is for the system logo toggling the game system switcher
$('#siteHeader').addEventListener('click', e => {
  e.stopPropagation();
  $('#systemMenu').classList.toggle('show');
  $('#menuDropdown').classList.remove('show');
  $('#menuBtn').setAttribute('aria-expanded', 'false');
});

// This is for the initial boot that loads the default system on page load
loadSystem('dnd');
