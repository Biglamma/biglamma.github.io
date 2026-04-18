// REEL_CELL_W is a fallback only — actual width is measured from DOM at spin time
const REEL_CELL_W = 140;

const CONFIG = {
  RARITIES: {
    common:    { label: 'Common',    color: '#7a7f8a', weight: 0.5000 },
    uncommon:  { label: 'Uncommon',  color: '#3fbf5a', weight: 0.3000 },
    rare:      { label: 'Rare',      color: '#3a7ccf', weight: 0.2000 },
    epic:      { label: 'Epic',      color: '#8a4faa', weight: 0.1000 },
    legendary: { label: 'Legendary', color: '#e67e22', weight: 0.0500 },
    mythical:  { label: 'Magical',   color: '#ff0000', weight: 0.0100 },
  },
  SYSTEMS: {
    mothership: {
      label: 'MOTHERSHIP',
      theme: 'theme-mothership',
      files: ['mosh-weapons.json', 'mosh-armor.json', 'mosh-equipment.json'],
      cases: [
        { id: 'm-wep', name: 'Arsenal',      color: '#e74c3c', group: 'Standard Issue',  filter: i => i.category === 'weapons'   },
        { id: 'm-arm', name: 'Aegis',        color: '#3498db', group: 'Standard Issue',  filter: i => i.category === 'armor'     },
        { id: 'm-eqp', name: 'Logistics',    color: '#95a5a6', group: 'Standard Issue',  filter: i => i.category === 'equipment' },
        { id: 'm-med', name: 'Medbay Cache', color: '#2ecc71', group: 'Scavenged Finds', filter: i => i.tags?.includes('medical') || i.name?.includes('Stim') },
        { id: 'm-sci', name: 'Research Lab', color: '#9b59b6', group: 'Scavenged Finds', filter: i => i.rarity === 'mythical'    || i.tags?.includes('science') },
        { id: 'm-mil', name: 'Military Deck',color: '#c0392b', group: 'Scavenged Finds', filter: i => i.tags?.includes('combat') || i.tags?.includes('heavy') },
      ],
    },
    dnd: {
      label: 'D&D',
      theme: 'theme-dnd',
      files: ['dnd-weapons.json', 'dnd-armor.json', 'dnd-equipment.json'],
      magicFiles: ['dnd-magic-items.json'],
      cases: [
        { id: 'd-wep',  name: 'Armory',          color: '#c0392b', group: 'Adventuring Gear', filter: i => i.category === 'weapons'   },
        { id: 'd-arm',  name: 'Bulwark',          color: '#2980b9', group: 'Adventuring Gear', filter: i => i.category === 'armor'     },
        { id: 'd-eqp',  name: 'Provisions',       color: '#7f8c8d', group: 'Adventuring Gear', filter: i => i.category === 'equipment' },
        { id: 'd-wiz',  name: "Wizard's Bag",     color: '#8e44ad', group: 'Recovered Spoils', filter: i => i.tags?.includes('magic')  || i.rarity === 'epic' },
        { id: 'd-dun',  name: 'Dungeon Hoard',    color: '#34495e', group: 'Recovered Spoils', filter: i => i.rarity !== 'common' && (i.tags?.includes('magic') || i.tags?.includes('loot')) },
        { id: 'd-nob',  name: 'Noble Treasury',   color: '#d4ac0d', group: 'Recovered Spoils', filter: i => i.cost > 500  || i.rarity === 'legendary' },
        { id: 'd-roy',  name: 'Royal Vault',      color: '#f1c40f', group: 'Recovered Spoils', filter: i => i.cost > 1000 || i.rarity === 'mythical'  },
        { id: 'd-test', name: 'Cocksure Mythic',  color: '#ff0000', group: 'Experimental',     filter: i => i.rarity === 'mythical' },
      ],
    },
  },
};

// ── STATE ─────────────────────────────────────────────────

class AppState {
  constructor() {
    this.items          = [];
    this.magicPool      = [];
    this.inventory      = [];
    this.disabledItems  = new Set();
    this.activeCase     = null;
    this.activeSystem   = 'mothership';
    this.isSpinning     = false;
    this.selectedInvIdx = null;
    // Panel filters
    this.lootCatFilter  = null;   // 'weapons' | 'armor' | 'equipment' | null
    this.lootRarFilter  = null;   // rarity key | null
    this.invCatFilter   = null;
    this.invRarFilter   = null;
  }

  setSystem(key) {
    this.activeSystem   = key;
    this.magicPool      = [];
    this.inventory      = JSON.parse(localStorage.getItem(`inv_${key}`) || '[]');
    this.disabledItems  = new Set(JSON.parse(localStorage.getItem(`dis_${key}`) || '[]'));
    this.selectedInvIdx = null;
    this.lootCatFilter  = null;
    this.lootRarFilter  = null;
    this.invCatFilter   = null;
    this.invRarFilter   = null;
  }

  saveInventory() { localStorage.setItem(`inv_${this.activeSystem}`, JSON.stringify(this.inventory)); }
  saveDisabled()  { localStorage.setItem(`dis_${this.activeSystem}`, JSON.stringify([...this.disabledItems])); }

  toggleDisabled(key) {
    this.disabledItems.has(key) ? this.disabledItems.delete(key) : this.disabledItems.add(key);
    this.saveDisabled();
  }
}

const state = new AppState();

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ── HELPERS ───────────────────────────────────────────────

function validImage(url) {
  if (!url) return undefined;
  if (url.includes('placeholder') || url.includes('via.placeholder')) return undefined;
  return url;
}

function getWeightedItem(pool) {
  const total = pool.reduce((sum, i) => sum + (CONFIG.RARITIES[i.rarity]?.weight || 0), 0);
  let r = Math.random() * total;
  for (const item of pool) {
    const w = CONFIG.RARITIES[item.rarity]?.weight || 0;
    if (r < w) return item;
    r -= w;
  }
  return pool[pool.length - 1];
}

function showPanel(name) {
  $$('.content-panel').forEach(p => { p.hidden = true; });
  $(`#${name}Panel`).hidden = false;
  $$('.menu-item').forEach(m => m.classList.toggle('active', m.dataset.tab === name));
  state.selectedInvIdx = null;
  const labels = { main: 'ROLL', inventory: 'INV', loot: 'LOOT' };
  $$('.panel-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === name);
  });
}

function enterCase(caseConfig) {
  state.activeCase     = caseConfig;
  state.selectedInvIdx = null;
  $('#caseGroups').hidden        = true;
  $('#caseOpenContainer').hidden = false;
  $('#reelWrap').hidden          = true;
  $('#openBtn').hidden           = false;
  $('#backBtn').hidden           = false;
}

function exitCase() {
  state.activeCase = null;
  $('#caseGroups').hidden        = false;
  $('#caseOpenContainer').hidden = true;
  $('#reelWrap').hidden          = true;
}

// ── DATA LOADING ──────────────────────────────────────────

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

  const batches = await Promise.all(sys.files.map(async file => {
    try {
      const json = await (await fetch(`./${file}`)).json();
      const cat  = file.includes('weapon') ? 'weapons' : file.includes('armor') ? 'armor' : 'equipment';
      const arr  = Array.isArray(json) ? json : (Object.values(json)[0] || []);
      return arr.map(i => ({ ...i, category: cat }));
    } catch { return []; }
  }));

  state.items = autoAssignRarity(batches.flat());

  // Magic portal trigger — always included in every pool; display as "Magical Item"
  state.items.push({
    name:     'Magical Item',
    rarity:   'mythical',
    category: 'equipment',
    _key:     'magic_portal_trigger',
  });

  if (sys.magicFiles) {
    const magicBatches = await Promise.all(sys.magicFiles.map(async file => {
      try {
        const json = await (await fetch(`./${file}`)).json();
        return json.artifacts || (Array.isArray(json) ? json : Object.values(json)[0] || []);
      } catch (e) { console.error('Magic file error:', e); return []; }
    }));

    state.magicPool = magicBatches.flat().map(i => ({
      ...i,
      rarity:   'mythical',
      category: i.category || 'equipment',
      _key:     i.name,
      image:    validImage(i.image),
    }));
  }

  renderAll();
}

function autoAssignRarity(items) {
  const sorted = [...items].sort((a, b) => (parseInt(a.cost) || 0) - (parseInt(b.cost) || 0));
  const total  = sorted.length;
  return sorted.map((item, i) => {
    const p      = i / total;
    const rarity = p >= 0.95 ? 'legendary' : p >= 0.80 ? 'epic' : p >= 0.60 ? 'rare' : p >= 0.30 ? 'uncommon' : 'common';
    return { ...item, _key: item.name, rarity, image: validImage(item.image) };
  });
}

// ── RENDERING ─────────────────────────────────────────────

function renderAll() {
  renderCases();
  renderLootFilters();
  renderInvFilters();
  renderLoot();
  renderInventory();
}

function renderSection(title, items, fn) {
  if (!items.length) return '';
  return `
    <div class="cat-section">
      <div class="cat-title">${title}</div>
      <div class="item-grid">${items.map(fn).join('')}</div>
    </div>`;
}

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
            <div class="case-tile-icon" style="background:${c.color}1a;border-color:${c.color}">📦</div>
            <div class="case-tile-name">${c.name}</div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

// Shared filter row builder
const FILTER_CATS = [
  { key: 'weapons',   label: 'Weapons'   },
  { key: 'armor',     label: 'Armor'     },
  { key: 'equipment', label: 'Equipment' },
];

function buildFilterHTML(activeCat, activeRar, panel) {
  // Category row — text labels
  const catRow = FILTER_CATS.map(c => `
    <button class="cat-filter-btn${activeCat === c.key ? ' active' : ''}"
      data-cat="${c.key}" data-panel="${panel}">${c.label}</button>`
  ).join('');

  // Rarity row — no text, colored blocks (6 rarities only; click active again to deselect)
  const rarEntries = Object.entries(CONFIG.RARITIES).map(([k, v]) => [k, v.color]);
  const rarRow = rarEntries.map(([key, color]) => {
    const active = activeRar === key;
    return `<button class="rar-filter-btn" data-rar="${key}" data-panel="${panel}"
      style="background:${active ? color : color + '44'};box-shadow:${active ? `0 0 5px ${color}88` : 'none'}"></button>`;
  }).join('');

  return `
    <div class="cat-filter-row">${catRow}</div>
    <div class="rar-filter-row">${rarRow}</div>`;
}

function renderLootFilters() {
  $('#lootFilters').innerHTML = buildFilterHTML(state.lootCatFilter, state.lootRarFilter, 'loot');
}

function renderInvFilters() {
  $('#invFilters').innerHTML = buildFilterHTML(state.invCatFilter, state.invRarFilter, 'inv');
}

function renderLoot() {
  const basePool     = state.items.filter(i => i._key !== 'magic_portal_trigger');
  // Magic pool items ARE the mythical tier — surfaced here
  const magicAsItems = state.magicPool.map(i => ({
    ...i, rarity: 'mythical', category: i.category || 'equipment',
  }));
  let items = [...basePool, ...magicAsItems];

  if (state.lootCatFilter) items = items.filter(i => i.category === state.lootCatFilter);
  if (state.lootRarFilter) items = items.filter(i => i.rarity   === state.lootRarFilter);

  const CATS = { weapons: 'Weapons', armor: 'Armor', equipment: 'Equipment' };
  const html = Object.entries(CATS)
    .map(([cat, label]) => renderSection(label, items.filter(i => i.category === cat), item => {
      const disabled = state.disabledItems.has(item._key);
      const col      = CONFIG.RARITIES[item.rarity].color;
      return `
        <div class="loot-item${disabled ? ' disabled' : ''}" data-key="${item._key}" style="border-color:${col}">
          ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
          <div class="item-name">${item.name}</div>
          <div class="item-rarity" style="color:${col}">${CONFIG.RARITIES[item.rarity].label}</div>
          ${disabled ? '<div class="excluded-badge">Excluded</div>' : ''}
        </div>`;
    }))
    .join('');

  $('#lootContent').innerHTML = html || '<div class="empty-state">No items match this filter</div>';
}

function renderInventory() {
  let items = [...state.inventory];
  if (state.invCatFilter) items = items.filter(i => i.category === state.invCatFilter);
  if (state.invRarFilter) items = items.filter(i => i.rarity   === state.invRarFilter);

  const CATS = { weapons: 'Weapons', armor: 'Armor', equipment: 'Equipment' };
  const html = Object.entries(CATS)
    .map(([cat, label]) => renderSection(label, items.filter(i => i.category === cat), item => {
      const idx      = state.inventory.indexOf(item);
      const selected = state.selectedInvIdx === idx;
      const col      = CONFIG.RARITIES[item.rarity]?.color ?? '#7a7f8a';
      return `
        <div class="inv-tile${selected ? ' selected' : ''}" data-inv-idx="${idx}" style="border-color:${col}">
          ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
          <div class="item-name">${item.name}</div>
          <div class="item-rarity" style="color:${col}">${CONFIG.RARITIES[item.rarity]?.label ?? ''}</div>
          <div class="inv-del-overlay" data-del-idx="${idx}">REMOVE</div>
        </div>`;
    }))
    .join('');

  $('#invContent').innerHTML = html || '<div class="empty-state">Inventory is empty — start rolling!</div>';
}

// ── REEL & SPIN ───────────────────────────────────────────

const REEL_TOTAL  = 100;  // total cells generated
const REEL_WINNER = 80;   // which cell is the winner (index)

function spin(forcedPool = null) {
  if (state.isSpinning && !forcedPool) return;

  const isMagicRespin = !!forcedPool;
  let pool;

  if (forcedPool) {
    pool = forcedPool;
  } else {
    // Case-filtered items, always append the magic trigger so every chest can roll magical
    const caseItems = state.items
      .filter(state.activeCase.filter)
      .filter(i => !state.disabledItems.has(i._key) && i._key !== 'magic_portal_trigger');
    const trigger = state.items.find(i => i._key === 'magic_portal_trigger');
    pool = trigger ? [...caseItems, trigger] : caseItems;
  }

  if (!pool.length) { alert('No items available!'); return; }

  state.isSpinning = true;

  const track    = $('#reelTrack');
  const reelWrap = $('#reelWrap');
  const reelItems = Array.from({ length: REEL_TOTAL }, () => getWeightedItem(pool));

  track.innerHTML = reelItems.map(item => `
    <div class="rc" style="--rc-col:${CONFIG.RARITIES[item.rarity].color}">
      ${item.image ? `<img class="rc-img" src="${item.image}" alt="${item.name}">` : ''}
      <div class="rc-name">${item.name}</div>
      ${isMagicRespin ? '<div class="magic-sparkle">✨</div>' : ''}
    </div>`).join('');

  $('#openBtn').hidden = true;
  $('#backBtn').hidden = true;
  reelWrap.hidden = false;

  // Force layout so getBoundingClientRect returns real values on all screen sizes
  reelWrap.getBoundingClientRect();
  const cellEl = track.querySelector('.rc');
  const cellW  = cellEl ? cellEl.getBoundingClientRect().width : REEL_CELL_W;

  track.style.transition = 'none';
  track.style.transform  = 'translateX(0)';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const offset = (REEL_WINNER * cellW) - (reelWrap.offsetWidth / 2 - cellW / 2);
    track.style.transition = `transform ${isMagicRespin ? '5s' : '6s'} cubic-bezier(0.1, 0, 0.1, 1)`;
    track.style.transform  = `translateX(-${offset}px)`;
  }));

  setTimeout(() => {
    const winner = { ...reelItems[REEL_WINNER] };

    if (winner._key === 'magic_portal_trigger') {
      if (!state.magicPool.length) {
        alert('The Vault is empty!');
        state.isSpinning = false;
        exitCase();
      } else {
        track.innerHTML = '';
        spin(state.magicPool);
      }
    } else {
      state.inventory.push(winner);
      state.saveInventory();
      state.isSpinning = false;
      showSplash(winner, isMagicRespin);
    }
  }, isMagicRespin ? 5500 : 6500);
}

function showSplash(item, isMagic = false) {
  const col    = isMagic ? CONFIG.RARITIES.mythical.color : (CONFIG.RARITIES[item.rarity]?.color || '#7a7f8a');
  const splash = document.createElement('div');
  splash.className = 'splash-overlay' + (isMagic ? ' magic-win' : '');
  splash.innerHTML = `
    <div class="splash-content" style="border-color:${col}">
      ${item.image ? `<img class="splash-img" src="${item.image}" alt="${item.name}">` : ''}
      <div class="splash-rarity" style="color:${col}">${isMagic ? '✨ ANCIENT MAGIC ✨' : CONFIG.RARITIES[item.rarity]?.label}</div>
      <h1 class="splash-name" style="color:${col}">${item.name}</h1>
      <div class="splash-hint">Tap anywhere to continue</div>
    </div>`;
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

// ── EVENT DELEGATION ──────────────────────────────────────

document.addEventListener('click', e => {
  const t = e.target;

  // Case tile
  const tile = t.closest('.case-tile');
  if (tile) {
    const c = CONFIG.SYSTEMS[state.activeSystem].cases.find(c => c.id === tile.dataset.id);
    if (c) enterCase(c);
    return;
  }

  if (t.id === 'backBtn') return exitCase();
  if (t.id === 'openBtn') return spin();

  // Inventory: delete overlay
  const delOverlay = t.closest('.inv-del-overlay');
  if (delOverlay) {
    const idx = parseInt(delOverlay.dataset.delIdx);
    state.inventory.splice(idx, 1);
    state.saveInventory();
    state.selectedInvIdx = null;
    return renderInventory();
  }

  // Inventory: select tile
  const invTile = t.closest('.inv-tile');
  if (invTile) {
    const idx = parseInt(invTile.dataset.invIdx);
    state.selectedInvIdx = state.selectedInvIdx === idx ? null : idx;
    return renderInventory();
  }

  // Loot: toggle disabled
  const lootItem = t.closest('.loot-item');
  if (lootItem) {
    state.toggleDisabled(lootItem.dataset.key);
    return renderLoot();
  }

  // Category filter button
  const catBtn = t.closest('.cat-filter-btn');
  if (catBtn) {
    const { panel, cat } = catBtn.dataset;
    if (panel === 'loot') {
      state.lootCatFilter = state.lootCatFilter === cat ? null : cat;
      renderLootFilters(); renderLoot();
    } else {
      state.invCatFilter = state.invCatFilter === cat ? null : cat;
      renderInvFilters(); renderInventory();
    }
    return;
  }

  // Rarity filter button
  const rarBtn = t.closest('.rar-filter-btn');
  if (rarBtn) {
    const { panel, rar } = rarBtn.dataset;
    if (panel === 'loot') {
      state.lootRarFilter = (rar && state.lootRarFilter !== rar) ? rar : null;
      renderLootFilters(); renderLoot();
    } else {
      state.invRarFilter = (rar && state.invRarFilter !== rar) ? rar : null;
      renderInvFilters(); renderInventory();
    }
    return;
  }

  // Nav menu item
  const menuItem = t.closest('.menu-item');
  if (menuItem) {
    showPanel(menuItem.dataset.tab);
    $('#menuDropdown').classList.remove('show');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    return;
  }

  // System switcher
  const sysItem = t.closest('.system-menu-item');
  if (sysItem) {
    loadSystem(sysItem.dataset.system);
    $('#systemMenu').classList.remove('show');
    return;
  }

  // Close menus on outside click
  if (!t.closest('#menuDropdown') && !t.closest('#menuBtn')) {
    $('#menuDropdown').classList.remove('show');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
  }
  if (!t.closest('#systemMenu') && !t.closest('#siteHeader')) {
    $('#systemMenu').classList.remove('show');
  }

  // Deselect inventory tile on outside click
  if (!t.closest('.inv-tile') && state.selectedInvIdx !== null) {
    state.selectedInvIdx = null;
    renderInventory();
  }
});

$('#menuBtn').addEventListener('click', e => {
  e.stopPropagation();
  const menu = $('#menuDropdown');
  menu.classList.toggle('show');
  $('#menuBtn').setAttribute('aria-expanded', menu.classList.contains('show'));
  $('#systemMenu').classList.remove('show');
});

$('#siteHeader').addEventListener('click', e => {
  e.stopPropagation();
  $('#systemMenu').classList.toggle('show');
  $('#menuDropdown').classList.remove('show');
  $('#menuBtn').setAttribute('aria-expanded', 'false');
});

loadSystem('dnd');
