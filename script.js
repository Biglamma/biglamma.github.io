const REEL_CELL_W = 140; // fallback — actual width measured from DOM at spin time

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
        { id: 'm-wep', name: 'Arsenal',       color: '#e74c3c', group: 'Standard Issue',  filter: i => i.category === 'weapons'   },
        { id: 'm-arm', name: 'Aegis',         color: '#3498db', group: 'Standard Issue',  filter: i => i.category === 'armor'     },
        { id: 'm-eqp', name: 'Logistics',     color: '#95a5a6', group: 'Standard Issue',  filter: i => i.category === 'equipment' },
        { id: 'm-med', name: 'Medbay Cache',  color: '#2ecc71', group: 'Scavenged Finds', filter: i => i.tags?.includes('medical') || i.name?.includes('Stim') },
        { id: 'm-sci', name: 'Research Lab',  color: '#9b59b6', group: 'Scavenged Finds', filter: i => i.rarity === 'mythical' || i.tags?.includes('science') },
        { id: 'm-mil', name: 'Military Deck', color: '#c0392b', group: 'Scavenged Finds', filter: i => i.tags?.includes('combat') || i.tags?.includes('heavy') },
      ],
    },
    dnd: {
      label: 'D&D',
      theme: 'theme-dnd',
      files: ['dnd-weapons.json', 'dnd-armor.json', 'dnd-equipment.json'],
      magicFiles: ['dnd-magic-items.json'],
      cases: [
        { id: 'd-wep',  name: 'Armory',        color: '#c0392b', group: 'Adventuring Gear', filter: i => i.category === 'weapons'   },
        { id: 'd-arm',  name: 'Bulwark',        color: '#2980b9', group: 'Adventuring Gear', filter: i => i.category === 'armor'     },
        { id: 'd-eqp',  name: 'Provisions',     color: '#7f8c8d', group: 'Adventuring Gear', filter: i => i.category === 'equipment' },
        { id: 'd-wiz',  name: "Wizard's Bag",   color: '#8e44ad', group: 'Recovered Spoils', filter: i => i.tags?.includes('magic') || i.rarity === 'epic' },
        { id: 'd-dun',  name: 'Dungeon Hoard',  color: '#34495e', group: 'Recovered Spoils', filter: i => i.rarity !== 'common' && (i.tags?.includes('magic') || i.tags?.includes('loot')) },
        { id: 'd-nob',  name: 'Noble Treasury', color: '#d4ac0d', group: 'Recovered Spoils', filter: i => i.cost > 500  || i.rarity === 'legendary' },
        { id: 'd-roy',  name: 'Royal Vault',    color: '#f1c40f', group: 'Recovered Spoils', filter: i => i.cost > 1000 || i.rarity === 'mythical'  },
        { id: 'd-myt',  name: 'Mythic Cache',   color: '#ff0000', group: 'Experimental',     filter: i => i.rarity === 'mythical' },
      ],
    },
  },
  MUTED_GROUPS: new Set(['Standard Issue', 'Adventuring Gear']),
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
    this.lootCatFilter  = null;
    this.lootRarFilter  = null;
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

// ── AUDIO ─────────────────────────────────────────────────

const SFX = {
  open: new Audio('sounds/open.ogg'),
  loop: new Audio('sounds/loop.ogg'),
};
SFX.loop.loop = true;

let _rateRaf = null;

function playOpen() {
  SFX.open.currentTime = 0;
  SFX.open.play().catch(() => {});
}

function startLoop(duration) {
  SFX.loop.currentTime    = 0;
  SFX.loop.playbackRate   = 2.0;   // starts fast
  SFX.loop.play().catch(() => {});

  const startRate  = 2.0;
  const endRate    = 0.5;          // slows to a crawl
  const startTime  = performance.now();
  const totalMs    = duration * 1000;

  cancelAnimationFrame(_rateRaf);

  function tick(now) {
    const t      = Math.min((now - startTime) / totalMs, 1);
    // ease-out cube — mirrors the CSS cubic-bezier feel
    const eased  = 1 - Math.pow(1 - t, 3);
    SFX.loop.playbackRate = startRate + (endRate - startRate) * eased;
    if (t < 1) _rateRaf = requestAnimationFrame(tick);
  }
  _rateRaf = requestAnimationFrame(tick);
}

function stopLoop() {
  cancelAnimationFrame(_rateRaf);
  SFX.loop.pause();
  SFX.loop.currentTime  = 0;
  SFX.loop.playbackRate = 1;
}

// ── HELPERS ───────────────────────────────────────────────

function resolveImageUrl(url) {
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

function switchToPanel(name) {
  $$('.content-panel').forEach(p => { p.hidden = true; });
  $(`#${name}Panel`).hidden = false;
  $$('.menu-item').forEach(m => m.classList.toggle('active', m.dataset.tab === name));
  state.selectedInvIdx = null;
  $$('.panel-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === name);
  });
}

function openCase(caseConfig) {
  state.activeCase     = caseConfig;
  state.selectedInvIdx = null;
  $('#caseGridContainer').hidden = true;
  $('#caseOpenView').hidden      = false;
  $('#reelContainer').hidden     = true;
  $('#openCaseBtn').hidden       = false;
  $('#backToCasesBtn').hidden    = false;
  populateCasePreview(caseConfig);
  $('#casePreview').hidden = false;
}

function populateCasePreview(caseConfig) {
  const icon = $('#casePreviewIcon');
  icon.style.borderColor = caseConfig.color;
  icon.style.background  = caseConfig.color + '1a';
  $('#casePreviewName').textContent  = caseConfig.name;
  $('#casePreviewName').style.color  = caseConfig.color;
}

function closeCases() {
  state.activeCase = null;
  $('#caseGridContainer').hidden = false;
  $('#caseOpenView').hidden      = true;
  $('#reelContainer').hidden     = true;
}

// ── DATA LOADING ──────────────────────────────────────────

async function loadSystem(key) {
  const sys = CONFIG.SYSTEMS[key];
  if (!sys) return;

  state.setSystem(key);
  document.body.className             = sys.theme;
  $('#systemSwitcherBtn').childNodes[0].textContent = sys.label + ' ';

  $$('.system-menu-item').forEach(el =>
    el.classList.toggle('active', el.dataset.system === key)
  );

  switchToPanel('main');
  closeCases();

  const batches = await Promise.all(sys.files.map(async file => {
    try {
      const json = await (await fetch(`./${file}`)).json();
      const cat  = file.includes('weapon') ? 'weapons' : file.includes('armor') ? 'armor' : 'equipment';
      const arr  = Array.isArray(json) ? json : (Object.values(json)[0] || []);
      return arr.map(i => ({ ...i, category: cat }));
    } catch { return []; }
  }));

  state.items = autoAssignRarity(batches.flat());

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
      image:    resolveImageUrl(i.image),
    }));
  }

  renderAllPanels();
}

function autoAssignRarity(items) {
  const sorted = [...items].sort((a, b) => (parseInt(a.cost) || 0) - (parseInt(b.cost) || 0));
  const total  = sorted.length;
  return sorted.map((item, i) => {
    const p      = i / total;
    const rarity = p >= 0.95 ? 'legendary' : p >= 0.80 ? 'epic' : p >= 0.60 ? 'rare' : p >= 0.30 ? 'uncommon' : 'common';
    return { ...item, _key: item.name, rarity, image: resolveImageUrl(item.image) };
  });
}

// ── RENDERING ─────────────────────────────────────────────

function renderAllPanels() {
  renderCases();
  renderLootFilters();
  renderInvFilters();
  renderLoot();
  renderInventory();
}

function renderItemSection(title, items, buildTileHTML) {
  if (!items.length) return '';
  return `
    <div class="cat-section">
      <div class="cat-title">${title}</div>
      <div class="item-grid">${items.map(buildTileHTML).join('')}</div>
    </div>`;
}

function renderCases() {
  const sys    = CONFIG.SYSTEMS[state.activeSystem];
  const groups = sys.cases.reduce((acc, c) => {
    (acc[c.group] = acc[c.group] || []).push(c);
    return acc;
  }, {});

  $('#caseGridContainer').innerHTML = Object.entries(groups).map(([title, cases]) => `
    <div class="case-group">
      <div class="case-group-title">${title}</div>
      <div class="case-grid">
        ${cases.map(c => {
          const tileColor = CONFIG.MUTED_GROUPS.has(title) ? '#95a5a6' : c.color;
          return `
            <div class="case-tile" data-id="${c.id}" style="border-color:${tileColor}">
              <div class="case-tile-icon" style="background:${tileColor}1a;border-color:${tileColor}">📦</div>
              <div class="case-tile-name">${c.name}</div>
            </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

const FILTER_CATS = [
  { key: 'weapons',   label: 'Weapons'   },
  { key: 'armor',     label: 'Armor'     },
  { key: 'equipment', label: 'Equipment' },
];

function buildFilterMarkup(activeCat, activeRar, panel) {
  const catRow = FILTER_CATS.map(c => `
    <button class="cat-filter-btn${activeCat === c.key ? ' active' : ''}"
      data-cat="${c.key}" data-panel="${panel}">${c.label}</button>`
  ).join('');

  const rarRow = Object.entries(CONFIG.RARITIES).map(([key, { color }]) => {
    const active = activeRar === key;
    return `<button class="rar-filter-btn" data-rar="${key}" data-panel="${panel}"
      style="background:${active ? color : color + '44'};box-shadow:${active ? `0 0 5px ${color}88` : 'none'}"></button>`;
  }).join('');

  return `
    <div class="cat-filter-row">${catRow}</div>
    <div class="rar-filter-row">${rarRow}</div>`;
}

function renderLootFilters() {
  $('#lootTableFilters').innerHTML = buildFilterMarkup(state.lootCatFilter, state.lootRarFilter, 'loot');
}

function renderInvFilters() {
  $('#inventoryFilters').innerHTML = buildFilterMarkup(state.invCatFilter, state.invRarFilter, 'inv');
}

function renderLoot() {
  const basePool     = state.items.filter(i => i._key !== 'magic_portal_trigger');
  const magicAsItems = state.magicPool.map(i => ({
    ...i, rarity: 'mythical', category: i.category || 'equipment',
  }));
  let items = [...basePool, ...magicAsItems];

  if (state.lootCatFilter) items = items.filter(i => i.category === state.lootCatFilter);
  if (state.lootRarFilter) items = items.filter(i => i.rarity   === state.lootRarFilter);

  const CATS = { weapons: 'Weapons', armor: 'Armor', equipment: 'Equipment' };
  const html = Object.entries(CATS)
    .map(([cat, label]) => renderItemSection(label, items.filter(i => i.category === cat), item => {
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

  $('#lootTableContent').innerHTML = html || '<div class="empty-state">No items match this filter</div>';
}

function renderInventory() {
  let items = [...state.inventory];
  if (state.invCatFilter) items = items.filter(i => i.category === state.invCatFilter);
  if (state.invRarFilter) items = items.filter(i => i.rarity   === state.invRarFilter);

  const CATS = { weapons: 'Weapons', armor: 'Armor', equipment: 'Equipment' };
  const html = Object.entries(CATS)
    .map(([cat, label]) => renderItemSection(label, items.filter(i => i.category === cat), item => {
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

  $('#inventoryContent').innerHTML = html || '<div class="empty-state">Inventory is empty — start rolling!</div>';
}

// ── REEL & SPIN ───────────────────────────────────────────

const REEL_TOTAL  = 100;
const REEL_WINNER = 80;
const SPIN_EASING   = 'cubic-bezier(0.04, 0.95, 0.2, 1)';
const SPIN_DURATION = 9;
const SPIN_MAGIC_DURATION = 7;
const SPIN_SETTLE_BUFFER  = 600;

function spinReel(forcedPool = null) {
  if (state.isSpinning && !forcedPool) return;

  const isMagicRespin = !!forcedPool;
  let pool;

  if (forcedPool) {
    pool = forcedPool;
  } else {
    const caseItems = state.items
      .filter(state.activeCase.filter)
      .filter(i => !state.disabledItems.has(i._key) && i._key !== 'magic_portal_trigger');
    const trigger = state.items.find(i => i._key === 'magic_portal_trigger');
    pool = trigger ? [...caseItems, trigger] : caseItems;
  }

  if (!pool.length) { alert('No items available!'); return; }

  state.isSpinning = true;

  const track         = $('#reelItemTrack');
  const reelContainer = $('#reelContainer');
  const reelItems     = Array.from({ length: REEL_TOTAL }, () => getWeightedItem(pool));

  track.innerHTML = reelItems.map(item => `
    <div class="rc" style="--rc-col:${CONFIG.RARITIES[item.rarity].color}">
      ${item.image ? `<img class="rc-img" src="${item.image}" alt="${item.name}">` : ''}
      <div class="rc-name">${item.name}</div>
      ${isMagicRespin ? '<div class="magic-sparkle">✨</div>' : ''}
    </div>`).join('');

  $('#openCaseBtn').hidden    = true;
  $('#backToCasesBtn').hidden = true;
  $('#casePreview').hidden    = true;
  reelContainer.hidden        = false;

  reelContainer.getBoundingClientRect(); // force layout
  const cellEl = track.querySelector('.rc');
  const cellW  = cellEl ? cellEl.getBoundingClientRect().width : REEL_CELL_W;

  track.style.transition = 'none';
  track.style.transform  = 'translateX(0)';

  const duration = isMagicRespin ? SPIN_MAGIC_DURATION : SPIN_DURATION;

  playOpen();
  startLoop(duration);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const offset = (REEL_WINNER * cellW) - (reelContainer.offsetWidth / 2 - cellW / 2);
    track.style.transition = `transform ${duration}s ${SPIN_EASING}`;
    track.style.transform  = `translateX(-${offset}px)`;
  }));

  setTimeout(() => {
    stopLoop();
    const winner = { ...reelItems[REEL_WINNER] };

    if (winner._key === 'magic_portal_trigger') {
      if (!state.magicPool.length) {
        alert('The Vault is empty!');
        state.isSpinning = false;
        closeCases();
      } else {
        track.innerHTML = '';
        spinReel(state.magicPool);
      }
    } else {
      state.inventory.push(winner);
      state.saveInventory();
      state.isSpinning = false;
      showWinSplash(winner, isMagicRespin);
    }
  }, (duration * 1000) + SPIN_SETTLE_BUFFER);
}

function showWinSplash(item, isMagic = false) {
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
    $('#reelContainer').hidden  = true;
    $('#openCaseBtn').hidden    = false;
    $('#backToCasesBtn').hidden = false;
    $('#casePreview').hidden    = false;
    renderInventory();
  };
  splash.addEventListener('click', dismiss);
  setTimeout(dismiss, 5000);
}

// ── EVENT DELEGATION ──────────────────────────────────────

document.addEventListener('click', e => {
  const t = e.target;

  const tile = t.closest('.case-tile');
  if (tile) {
    const c = CONFIG.SYSTEMS[state.activeSystem].cases.find(c => c.id === tile.dataset.id);
    if (c) openCase(c);
    return;
  }

  if (t.id === 'backToCasesBtn') return closeCases();
  if (t.id === 'openCaseBtn')    return spinReel();

  const delOverlay = t.closest('.inv-del-overlay');
  if (delOverlay) {
    const idx = parseInt(delOverlay.dataset.delIdx);
    state.inventory.splice(idx, 1);
    state.saveInventory();
    state.selectedInvIdx = null;
    return renderInventory();
  }

  const invTile = t.closest('.inv-tile');
  if (invTile) {
    const idx = parseInt(invTile.dataset.invIdx);
    state.selectedInvIdx = state.selectedInvIdx === idx ? null : idx;
    return renderInventory();
  }

  const lootItem = t.closest('.loot-item');
  if (lootItem) {
    state.toggleDisabled(lootItem.dataset.key);
    return renderLoot();
  }

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

  const menuItem = t.closest('.menu-item');
  if (menuItem) {
    switchToPanel(menuItem.dataset.tab);
    $('#navMenuDropdown').classList.remove('show');
    $('#navMenuBtn').setAttribute('aria-expanded', 'false');
    return;
  }

  const sysItem = t.closest('.system-menu-item');
  if (sysItem) {
    loadSystem(sysItem.dataset.system);
    $('#systemSwitcherMenu').classList.remove('show');
    return;
  }

  if (!t.closest('#navMenuDropdown') && !t.closest('#navMenuBtn')) {
    $('#navMenuDropdown').classList.remove('show');
    $('#navMenuBtn').setAttribute('aria-expanded', 'false');
  }
  if (!t.closest('#systemSwitcherMenu') && !t.closest('#systemSwitcherBtn')) {
    $('#systemSwitcherMenu').classList.remove('show');
  }

  if (!t.closest('.inv-tile') && state.selectedInvIdx !== null) {
    state.selectedInvIdx = null;
    renderInventory();
  }
});

$('#navMenuBtn').addEventListener('click', e => {
  e.stopPropagation();
  const menu = $('#navMenuDropdown');
  menu.classList.toggle('show');
  $('#navMenuBtn').setAttribute('aria-expanded', menu.classList.contains('show'));
  $('#systemSwitcherMenu').classList.remove('show');
});

$('#systemSwitcherBtn').addEventListener('click', e => {
  e.stopPropagation();
  const menu = $('#systemSwitcherMenu');
  menu.classList.toggle('show');
  $('#systemSwitcherBtn').setAttribute('aria-expanded', menu.classList.contains('show'));
  $('#navMenuDropdown').classList.remove('show');
  $('#navMenuBtn').setAttribute('aria-expanded', 'false');
});

loadSystem('dnd');
