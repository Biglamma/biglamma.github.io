const RARITIES = {
  common:    { label: 'Common',    color: '#7a7f8a' },
  uncommon:  { label: 'Uncommon',  color: '#3fbf5a' },
  rare:      { label: 'Rare',      color: '#3a7ccf' },
  epic:      { label: 'Epic',      color: '#8a4faa' },
  legendary: { label: 'Legendary', color: '#e67e22' }
};

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary'];

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

let ITEMS = [];
let activeCase = null;
let activeRarityFilter = null;
let spinning = false;
let inventory = JSON.parse(localStorage.getItem("inventory") || "[]");

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

async function initItems() {
  const all = await loadAllItems();
  if (!all.length) return;

  ITEMS = autoAssignRarities(all);

  renderCaseTiles();
  renderCaseNav();
  renderLootRarityTabs();
  renderLootPanel();
  updateInventory();
  buildReel();
}

initItems();

document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('menuDropdown').classList.toggle('show');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#menuBtn') && !e.target.closest('.menu-dropdown')) {
    document.getElementById('menuDropdown').classList.remove('show');
  }
});

function switchTab(tab) {
  document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(tab + 'Panel').classList.add('active');

  document.querySelectorAll('.menu-item').forEach(m => {
    m.classList.toggle('active', m.dataset.tab === tab);
  });

  if (tab === 'loot') {
    renderLootPanel();
    renderLootRarityTabs();
  }
}

document.querySelectorAll('.menu-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function renderCaseTiles() {
  const grid = document.getElementById('caseSelectGrid');

  grid.innerHTML = CASES.map(c => `
    <div class="case-tile" data-case="${c.id}" style="border-color:${c.color}">
      <div style="font-size:20px; margin-bottom:6px;">📦</div>
      <div>${c.name}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.case-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.case;
      activeCase = CASES.find(c => c.id === id);
      enterCaseOpening();
    });
  });
}

function enterCaseOpening() {
  document.getElementById('caseSelectGrid').style.display = 'none';
  document.getElementById('caseOpenArea').style.display = 'flex';

  renderCaseNav();
  buildReel();
}

document.getElementById('backBtn').addEventListener('click', () => {
  document.getElementById('caseOpenArea').style.display = 'none';
  document.getElementById('caseSelectGrid').style.display = 'grid';
});

function renderCaseNav() {
  const nav = document.getElementById('caseNav');

  nav.innerHTML = CASES.map(c => `
    <button class="case-tab ${activeCase && c.id === activeCase.id ? 'active' : ''}"
      style="--case-col:${c.color}"
      data-case="${c.id}">
      ${c.name}
    </button>
  `).join('');

  nav.querySelectorAll('.case-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCase = CASES.find(c => c.id === btn.dataset.case);
      renderCaseNav();
      buildReel();
    });
  });
}

function renderLootRarityTabs() {
  const container = document.querySelector('.rarity-tabs');

  container.innerHTML = RARITY_ORDER.map(r => `
    <div class="rarity-tab ${r} ${activeRarityFilter === r ? 'active' : ''}"
         data-rarity="${r}">
    </div>
  `).join('');

  container.querySelectorAll('.rarity-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const r = tab.dataset.rarity;
      activeRarityFilter = activeRarityFilter === r ? null : r;
      renderLootRarityTabs();
      renderLootPanel();
    });
  });
}

function renderLootPanel() {
  const content = document.getElementById('lootContent');
  if (!ITEMS.length) return;

  let html = '';

  Object.entries(ITEM_CATEGORIES).forEach(([catKey, cat]) => {
    let items = ITEMS.filter(i => i.category === catKey);

    if (activeRarityFilter) {
      items = items.filter(i => i.rarity === activeRarityFilter);
    }

    if (!items.length) return;

    items = items.sort((a, b) => {
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    });

    html += `
      <div class="loot-category-section">
        <div class="loot-category-header">${cat.label}</div>
        <div class="loot-items-list">
          ${items.map(i => {
            const rar = RARITIES[i.rarity];
            return `
              <div class="loot-item" style="border-left: 4px solid ${rar.color}">
                <div class="loot-item-icon">${imgOrEmoji(i)}</div>
                <div class="loot-item-name">${i.name}</div>
                <div class="loot-item-rarity">${rar.label}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  if (!html) {
    html = '<div class="loot-empty">No items found</div>';
  }

  content.innerHTML = html;
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

function showResult(item) {
  const rar = RARITIES[item.rarity];
  const panel = document.getElementById('resultPanel');

  panel.querySelector('.result-stripe').style.background = rar.color;
  panel.querySelector('.result-img-glow').style.setProperty('--rarity-col', rar.color);
  panel.querySelector('.result-rarity').style.color = rar.color;

  panel.querySelector('.result-icon').innerHTML = imgOrEmoji(item);
  panel.querySelector('.result-name').textContent = item.name;
  panel.querySelector('.result-desc').textContent = item.description || '';

  panel.style.display = 'block';
  panel.classList.add('show');

  document.getElementById('openBtn').style.display = 'block';
}

function addToInventory(item) {
  inventory.push(item);
  localStorage.setItem("inventory", JSON.stringify(inventory));
  updateInventory();
}

function updateInventory() {
  const grid = document.getElementById('invGrid');
  if (!inventory.length) {
    grid.innerHTML = '<div class="inv-empty">No items yet</div>';
    return;
  }

  grid.innerHTML = inventory.map((i, idx) => {
    const rar = RARITIES[i.rarity];
    return `
      <div class="inv-item" style="--rarity-col:${rar.color}">
        <button class="delete-x" data-index="${idx}">×</button>
        <div class="inv-icon">${imgOrEmoji(i)}</div>
        <div class="inv-name">${i.name}</div>
        <div class="inv-rar">${rar.label}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.delete-x').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.index;
      inventory.splice(idx, 1);
      localStorage.setItem("inventory", JSON.stringify(inventory));
      updateInventory();
    });
  });
}
