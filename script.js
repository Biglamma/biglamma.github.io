// ------------------------------------------------------------
// RARITIES
// ------------------------------------------------------------

const RARITIES = {
  common:    { label: 'Common',    color: '#7a7f8a' },
  uncommon:  { label: 'Uncommon',  color: '#3fbf5a' },
  rare:      { label: 'Rare',      color: '#3a7ccf' },
  epic:      { label: 'Epic',      color: '#8a4faa' },
  legendary: { label: 'Legendary', color: '#e67e22' }
};

// Display order for rarities (low to high)
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Item categories (main display organization)
const ITEM_CATEGORIES = {
  weapons:   { label: 'Weapons' },
  armor:     { label: 'Armor' },
  equipment: { label: 'Equipment' }
};

// Tags are internal only - used for organizing drop pools, not displayed
const TAGS = {
  "tools": true, "medical": true, "tech": true, "material": true, "consumable": true, "apparel": true,
  "melee": true, "ranged": true, "sidearm": true, "heavy": true, "explosive": true, "throwable": true,
  "energy": true, "utility": true, "ammunition": true, "tool": true, "combat": true
};

// ------------------------------------------------------------
// CASES
// ------------------------------------------------------------

const CASES = [
  { id: 'c1', name: 'Teamster Cache',   color: '#7a7f8a', pool: ['common','uncommon'] },
  { id: 'c2', name: 'Corp Requisition', color: '#3fbf5a', pool: ['common','uncommon','rare'] },
  { id: 'c3', name: 'Marine Armory',    color: '#3a7ccf', pool: ['uncommon','rare','epic'] },
  { id: 'c4', name: 'Black Budget',     color: '#e67e22', pool: ['rare','epic','legendary'] }
];

// ------------------------------------------------------------
// GLOBALS
// ------------------------------------------------------------

let ITEMS = [];
let activeCase = CASES[0];
let activeRarityFilter = null; // null means show all
let spinning = false;
let inventory = JSON.parse(localStorage.getItem("inventory") || "[]");

// ------------------------------------------------------------
// JSON LOADING + COST PARSING + AUTO RARITY + CATEGORY ASSIGNMENT
// ------------------------------------------------------------

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

    // Ensure tags exist (internal use only)
    if (!item.tags) item.tags = [];
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
  renderRarityFilter();
  buildReel();
  updateInventory();
}

// ------------------------------------------------------------
// IMAGE FALLBACK
// ------------------------------------------------------------

function imgOrEmoji(item) {
  const rar = RARITIES[item.rarity];
  if (!item.image) return '';

  return `<img src="${item.image}" alt="" onerror="this.onerror=null; this.replaceWith('')">`;
}

// ------------------------------------------------------------
// AUTO-DETECT CELL WIDTH
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
// RARITY FILTER (Vertical Tabs)
// ------------------------------------------------------------

function renderRarityFilter() {
  const filterContainer = document.getElementById('rarityFilter');
  
  filterContainer.innerHTML = RARITY_ORDER.map(rarityKey => {
    const rar = RARITIES[rarityKey];
    return `
      <button class="rarity-tab ${activeRarityFilter === rarityKey ? 'active' : ''}"
        data-rarity="${rarityKey}"
        style="background-color: ${rar.color}"
        title="${rar.label}">
      </button>
    `;
  }).join('');

  filterContainer.querySelectorAll('.rarity-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const rarity = btn.dataset.rarity;
      activeRarityFilter = activeRarityFilter === rarity ? null : rarity;
      renderRarityFilter();
      renderLootPanel();
    });
  });
}

// ------------------------------------------------------------
// LOOT PANEL (organized by category, filtered by rarity, sorted by rarity asc)
// ------------------------------------------------------------

function renderLootPanel() {
  const content = document.getElementById('lootContent');
  if (!ITEMS.length) return;

  let html = '';

  // Group items by category
  Object.entries(ITEM_CATEGORIES).forEach(([catKey, cat]) => {
    const itemsInCategory = ITEMS.filter(i => i.category === catKey);
    
    if (!itemsInCategory.length) return;

    // Filter by active rarity if selected
    let displayItems = itemsInCategory;
    if (activeRarityFilter) {
      displayItems = itemsInCategory.filter(i => i.rarity === activeRarityFilter);
    }

    if (!displayItems.length) return;

    // Sort by rarity (low to high)
    displayItems = displayItems.sort((a, b) => {
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    });

    html += `<div class="loot-category-section">
      <div class="loot-category-header">${cat.label}</div>
      <div class="loot-items-list">
        ${displayItems.map(i => {
          const rar = RARITIES[i.rarity];
          return `
            <div class="loot-item" style="border-left: 4px solid ${rar.color}">
              <div class="loot-item-icon">${imgOrEmoji(i)}</div>
              <div class="loot-item-name">${i.name}</div>
              <div class="loot-item-rarity">${rar.label}</div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  if (!html) {
    html = '<div class="loot-empty">No items found</div>';
  }

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
      <span>${c.name}</span>
    </button>
  `).join('');

  nav.querySelectorAll('.case-tab').forEach(btn => {
    btn.addEventListener('click', () => selectCase(btn.dataset.case));
  });
}

function selectCase(id) {
  activeCase = CASES.find(c => c.id === id);
  renderCaseNav();
  buildReel();
}

// ------------------------------------------------------------
// ITEM PICKING (from pool)
// ------------------------------------------------------------

function pickItem(pool) {
  const candidates = ITEMS.filter(i => pool.includes(i.rarity));
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

  for (let i = 0; i < 140; i++) {
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
  const rarityFilter = document.getElementById('rarityFilter');

  openBtn.style.display = 'none';
  rarityFilter.style.display = 'none';
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

    const rarityFilter = document.getElementById('rarityFilter');
    rarityFilter.style.display = 'flex';
  }, delay);
}

// ------------------------------------------------------------
// INVENTORY (by category only, no emoticons)
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

  let html = '';

  // Group inventory by category
  Object.entries(ITEM_CATEGORIES).forEach(([catKey, cat]) => {
    const itemsOfCategory = inventory.filter(i => i.category === catKey);
    
    if (!itemsOfCategory.length) return;

    html += `
      <div class="inv-category-section">
        <div class="inv-category-header">${cat.label}</div>
        <div class="inv-category-items">
          ${itemsOfCategory.map(item => {
            const rar = RARITIES[item.rarity];
            return `
              <div class="inv-item" style="--rarity-col:${rar.color}; border-left: 4px solid ${rar.color}" data-id="${item.id}">
                <button class="delete-x">×</button>
                <div class="inv-icon">${imgOrEmoji(item)}</div>
                <div class="inv-name">${item.name}</div>
                <div class="inv-rar">${rar.label}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  });

  grid.innerHTML = html;

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
// INIT
// ------------------------------------------------------------

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM ready — loading items...");

  await initItems();
  switchTab('main');

  console.log("Initialization complete.");
});
