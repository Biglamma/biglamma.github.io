// This is for the reel cell width — must stay in sync with .rc { min-width } in CSS
const REEL_CELL_W = 140;

// This is for all static configuration: rarities and game systems with their stash definitions
const CONFIG = {
  RARITIES: {
    common:    { label: 'Common',    color: '#7a7f8a', weight: 0.6000 }, 
    uncommon:  { label: 'Uncommon',  color: '#3fbf5a', weight: 0.2500 }, 
    rare:      { label: 'Rare',      color: '#3a7ccf', weight: 0.1000 }, 
    epic:      { label: 'Epic',      color: '#8a4faa', weight: 0.0400 }, 
    legendary: { label: 'Legendary', color: '#e67e22', weight: 0.0090 }, 
    mythical:  { label: 'MAGIC ROLL', color: '#ff0000', weight: 0.0010 }, // 0.1% Chance
  },
  SYSTEMS: {
    mothership: {
      label: 'MOTHERSHIP',
      theme: 'theme-mothership',
      files: ['mosh-weapons.json', 'mosh-armor.json', 'mosh-equipment.json'],
      cases: [
        { id: 'm-wep', name: 'Weapon Crate',  color: '#e74c3c', group: 'Standard Issue', filter: i => i.category === 'weapons'   },
        { id: 'm-arm', name: 'Armor Locker',  color: '#3498db', group: 'Standard Issue', filter: i => i.category === 'armor'     },
        { id: 'm-tls', name: 'Tool Kit',      color: '#95a5a6', group: 'Standard Issue', filter: i => i.category === 'equipment' },
        { id: 'm-med', name: 'Medbay Cache',  color: '#2ecc71', group: 'Special Ops',    filter: i => i.tags?.includes('medical') || i.name?.includes('Stim') },
        { id: 'm-sci', name: 'Research Lab',  color: '#9b59b6', group: 'Special Ops',    filter: i => i.rarity === 'mythical'    || i.tags?.includes('science') },
        { id: 'm-mil', name: 'Military Deck', color: '#c0392b', group: 'Special Ops',    filter: i => i.tags?.includes('combat') || i.tags?.includes('heavy')  },
      ],
    },
    dnd: {
      label: 'D&D 5E',
      theme: 'theme-dnd',
      files: ['dnd-weapons.json', 'dnd-armor.json', 'dnd-equipment.json'],
      magicFiles: ['dnd-magic-items.json'], 
      cases: [
        { id: 'd-pea', name: "Peasant's Stash", color: '#7f8c8d', group: 'Common Folk', filter: i => i.rarity === 'common'     },
        { id: 'd-wep', name: 'The Armory',      color: '#c0392b', group: 'Common Folk', filter: i => i.category === 'weapons'  },
        { id: 'd-arm', name: 'The Bulwark',      color: '#2980b9', group: 'Common Folk', filter: i => i.category === 'armor'    },
        { id: 'd-wiz', name: "Wizard's Bag",    color: '#8e44ad', group: 'Rare Finds',  filter: i => i.tags?.includes('magic') || i.rarity === 'epic'       },
        { id: 'd-dun', name: 'Dungeon Hoard',   color: '#34495e', group: 'Rare Finds',  filter: i => i.rarity !== 'common'    && (i.tags?.includes('magic') || i.tags?.includes('loot')) },
        { id: 'd-nob', name: 'Noble Treasury',  color: '#d4ac0d', group: 'Rare Finds',  filter: i => i.cost > 500              || i.rarity === 'legendary'   },
        { id: 'd-roy', name: 'Royal Vault',      color: '#f1c40f', group: 'Rare Finds',  filter: i => i.cost > 1000             || i.rarity === 'mythical'    },
        { id: 'd-test', name: 'Cocksure Mythic', color: '#ff0000', group: 'Experimental', filter: i => i.rarity === 'mythical' }, // TEST CASE
      ],
    },
  },
};

class AppState {
  constructor() {
    this.items          = [];
    this.magicPool      = [];
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
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// WEIGHTED SELECTION LOGIC
function getWeightedItem(pool) {
  const totalWeight = pool.reduce((sum, item) => sum + (CONFIG.RARITIES[item.rarity]?.weight || 0), 0);
  let random = Math.random() * totalWeight;

  for (const item of pool) {
    const itemWeight = CONFIG.RARITIES[item.rarity].weight;
    if (random < itemWeight) return item;
    random -= itemWeight;
  }
  return pool[0];
}

async function loadSystem(key) {
  const sys = CONFIG.SYSTEMS[key];
  if (!sys) return;

  state.setSystem(key);
  document.body.className      = sys.theme;
  $('#siteHeader').textContent = sys.label;

  $$('.system-menu-item').forEach(el => el.classList.toggle('active', el.dataset.system === key));

  showPanel('main');
  exitCase();

  // Load Standard Items
  const standardBatches = await Promise.all(sys.files.map(async file => {
    try {
      const res = await fetch(`./${file}`);
      const json = await res.json();
      const cat = file.includes('weapon') ? 'weapons' : file.includes('armor') ? 'armor' : 'equipment';
      const arr = Array.isArray(json) ? json : (Object.values(json)[0] || []);
      return arr.map(i => ({ ...i, category: cat }));
    } catch { return []; }
  }));
  
  state.items = autoAssignRarity(standardBatches.flat());

  // Load Hidden Magic Pool
  if (sys.magicFiles) {
    const magicBatches = await Promise.all(sys.magicFiles.map(async file => {
      try {
        const res = await fetch(`./${file}`);
        const json = await res.json();
        return Array.isArray(json) ? json : (Object.values(json)[0] || []);
      } catch { return []; }
    }));
    state.magicPool = magicBatches.flat().map(i => ({ ...i, rarity: 'legendary', _key: i.name }));
  }

  renderAll();
}

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
    
    return { ...item, _key: item.name, rarity };
  });
}

function renderSection(title, items, renderItemFn) {
  if (!items.length) return '';
  return `
    <div class="cat-section">
      <div class="cat-title">${title}</div>
      <div class="item-grid">${items.map(renderItemFn).join('')}</div>
    </div>
  `;
}

function spin() {
  if (state.isSpinning) return;

  let pool = state.items
    .filter(state.activeCase.filter)
    .filter(i => !state.disabledItems.has(i._key));

  // Add the "Roll Again" Trigger item
  const magicTrigger = { name: "MAGIC ROLL", rarity: "mythical", isTrigger: true, _key: "trigger" };
  pool.push(magicTrigger);

  state.isSpinning = true;
  const track = $('#reelTrack');
  const reelWrap = $('#reelWrap');
  
  const reelItems = Array.from({ length: 80 }, () => getWeightedItem(pool));

  track.innerHTML = reelItems.map(item => `
    <div class="rc" style="--rc-col:${CONFIG.RARITIES[item.rarity].color}">
      ${item.image ? `<img class="rc-img" src="${item.image}" alt="${item.name}">` : ''}
      <div class="rc-name">${item.name}</div>
    </div>
  `).join('');

  $('#openBtn').hidden = true;
  $('#backBtn').hidden = true;
  reelWrap.hidden = false;

  track.style.transition = 'none';
  track.style.transform  = 'translateX(0)';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const winnerIdx = 70;
    const offset = (winnerIdx * REEL_CELL_W) - (reelWrap.offsetWidth / 2 - REEL_CELL_W / 2);
    track.style.transition = 'transform 6s cubic-bezier(0.1, 0, 0.1, 1)';
    track.style.transform  = `translateX(-${offset}px)`;
  }));

  setTimeout(() => {
    const winner = reelItems[70];
    if (winner.isTrigger) {
      handleMagicBonus();
    } else {
      state.inventory.push({ ...winner });
      state.saveInventory();
      state.isSpinning = false;
      showSplash(winner);
    }
  }, 6500);
}

function handleMagicBonus() {
  if (!state.magicPool.length) {
    alert("The weave is empty!");
    state.isSpinning = false;
    return;
  }
  const magicWinner = state.magicPool[Math.floor(Math.random() * state.magicPool.length)];
  state.inventory.push({ ...magicWinner });
  state.saveInventory();
  state.isSpinning = false;
  showSplash(magicWinner, true);
}

function showSplash(item, isMagic = false) {
  const col = isMagic ? CONFIG.RARITIES.mythical.color : CONFIG.RARITIES[item.rarity].color;
  const splash = document.createElement('div');
  splash.className = 'splash-overlay';
  splash.innerHTML = `
    <div class="splash-content" style="border-color:${col}">
      ${item.image ? `<img class="splash-img" src="${item.image}" alt="${item.name}">` : ''}
      <div class="splash-rarity" style="color:${col}">${isMagic ? '✨ ANCIENT MAGIC ✨' : CONFIG.RARITIES[item.rarity].label}</div>
      <h1 class="splash-name" style="color:${col}">${item.name}</h1>
      <div class="splash-hint">Tap to continue</div>
    </div>
  `;
  document.body.appendChild(splash);
  
  const dismiss = () => {
    splash.remove(); 
    $('#reelWrap').hidden = true;
    $('#openBtn').hidden = false;
    $('#backBtn').hidden = false;
    renderInventory();
  };
  splash.onclick = dismiss;
}

function renderAll() { renderCases(); renderRarityTabs(); renderLoot(); renderInventory(); }

function renderCases() {
  const sys = CONFIG.SYSTEMS[state.activeSystem];
  const groups = sys.cases.reduce((acc, c) => { (acc[c.group] = acc[c.group] || []).push(c); return acc; }, {});
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

function renderRarityTabs() {
  const entries = [['', { label: 'All', color: 'var(--dim)' }], ...Object.entries(CONFIG.RARITIES)];
  $('#rarityTabs').innerHTML = entries.map(([key, r]) => {
    const active = key === '' ? state.rarityFilter === null : state.rarityFilter === key;
    return `<button class="rarity-tab" data-rarity="${key}" style="border-color:${r.color}; background:${active ? r.color : 'transparent'}; color:${active ? '#fff' : r.color}">${r.label}</button>`;
  }).join('');
}

function renderLoot() {
  const visible = state.rarityFilter ? state.items.filter(i => i.rarity === state.rarityFilter) : state.items;
  const CATS = { weapons: 'Weapons', armor: 'Armor', equipment: 'Tools & Equipment' };
  $('#lootContent').innerHTML = Object.entries(CATS).map(([cat, label]) =>
    renderSection(label, visible.filter(i => i.category === cat), item => {
      const disabled = state.disabledItems.has(item._key);
      const col = CONFIG.RARITIES[item.rarity].color;
      return `
        <div class="loot-item${disabled ? ' disabled' : ''}" data-key="${item._key}" style="border-color:${col}">
          ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
          <div class="item-name">${item.name}</div>
          <div class="item-rarity" style="color:${col}">${CONFIG.RARITIES[item.rarity].label}</div>
        </div>`;
    })
  ).join('') || '<div class="empty-state">No items found</div>';
}

function renderInventory() {
  $('#invCount').textContent = `${state.inventory.length} Items`;
  const CATS = { weapons: 'Weapons', armor: 'Armor', equipment: 'Tools & Equipment' };
  $('#invContent').innerHTML = Object.entries(CATS).map(([cat, label]) =>
    renderSection(label, state.inventory.filter(i => i.category === cat), item => {
      const idx = state.inventory.indexOf(item);
      const col = CONFIG.RARITIES[item.rarity]?.color ?? '#7a7f8a';
      return `
        <div class="inv-tile" data-inv-idx="${idx}" style="border-color:${col}">
          ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
          <div class="item-name">${item.name}</div>
          <div class="inv-del-overlay" data-del-idx="${idx}">REMOVE</div>
        </div>`;
    })
  ).join('') || '<div class="empty-state">Inventory empty</div>';
}

function showPanel(name) {
  $$('.content-panel').forEach(p => p.hidden = true);
  $(`#${name}Panel`).hidden = false;
  $$('.menu-item').forEach(m => m.classList.toggle('active', m.dataset.tab === name));
}

function enterCase(c) { state.activeCase = c; $('#caseGroups').hidden = true; $('#caseOpenContainer').hidden = false; $('#reelWrap').hidden = true; $('#openBtn').hidden = false; $('#backBtn').hidden = false; }
function exitCase() { state.activeCase = null; $('#caseGroups').hidden = false; $('#caseOpenContainer').hidden = true; $('#reelWrap').hidden = true; }

document.addEventListener('click', e => {
  const t = e.target;
  const tile = t.closest('.case-tile');
  if (tile) enterCase(CONFIG.SYSTEMS[state.activeSystem].cases.find(c => c.id === tile.dataset.id));
  if (t.id === 'openBtn') spin();
  if (t.id === 'backBtn') exitCase();
  
  const delOverlay = t.closest('.inv-del-overlay');
  if (delOverlay) {
    state.inventory.splice(parseInt(delOverlay.dataset.delIdx), 1);
    state.saveInventory();
    renderInventory();
    return;
  }

  const invTile = t.closest('.inv-tile');
  if (invTile) {
    const idx = parseInt(invTile.dataset.invIdx);
    state.selectedInvIdx = state.selectedInvIdx === idx ? null : idx;
    $$('.inv-tile').forEach((el, i) => el.classList.toggle('selected', i === state.selectedInvIdx));
    return;
  }

  if (t.closest('.loot-item')) { state.toggleDisabled(t.closest('.loot-item').dataset.key); renderLoot(); }
  
  const rarityTab = t.closest('.rarity-tab');
  if (rarityTab) {
    const r = rarityTab.dataset.rarity;
    state.rarityFilter = (r && state.rarityFilter !== r) ? r : null;
    renderRarityTabs(); renderLoot();
  }

  const menuItem = t.closest('.menu-item');
  if (menuItem) showPanel(menuItem.dataset.tab);

  const sysItem = t.closest('.system-menu-item');
  if (sysItem) loadSystem(sysItem.dataset.system);
});

loadSystem('mothership');
