const RARITIES = {
  common:    { label: 'Common',    color: '#7a7f8a' },
  uncommon:  { label: 'Uncommon',  color: '#3fbf5a' },
  rare:      { label: 'Rare',      color: '#3a7ccf' },
  epic:      { label: 'Epic',      color: '#8a4faa' },
  legendary: { label: 'Legendary', color: '#e67e22' },
  mythical:  { label: 'Mythical',  color: '#ff0000' }
};

const RARITY_ORDER = Object.keys(RARITIES);

const SYSTEMS = {
  mothership: {
    label: 'MOTHERSHIP',
    theme: 'theme-mothership',
    cases: [
      { id: 'c1', name: 'Teamster Cache',   color: '#7a7f8a', pool: ['common','uncommon'] },
      { id: 'c2', name: 'Corp Requisition', color: '#3fbf5a', pool: ['common','uncommon','rare'] },
      { id: 'c3', name: 'Marine Armory',    color: '#3a7ccf', pool: ['uncommon','rare','epic'] },
      { id: 'c4', name: 'Black Budget',     color: '#e67e22', pool: ['rare','epic','legendary'] }
    ],
    itemFiles: ['mosh-weapons.json', 'mosh-armor.json', 'mosh-equipment.json'],
    categories: { weapons: 'Weapons', armor: 'Armor', equipment: 'Equipment' }
  },
  dnd: {
    label: 'D&D',
    theme: 'theme-dnd',
    cases: [
      { id: 'd1', name: "Adventurer's Pack", color: '#7a7f8a', pool: ['common','uncommon'] },
      { id: 'd2', name: "Merchant's Stock",  color: '#3fbf5a', pool: ['common','uncommon','rare'] },
      { id: 'd3', name: "Dragon's Hoard",    color: '#e67e22', pool: ['rare','epic','legendary'] }
    ],
    itemFiles: ['dnd-weapons.json', 'dnd-armor.json', 'dnd-equipment.json'],
    categories: { weapons: 'Weapons', armor: 'Armour', equipment: 'Items' }
  }
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

class AppState {
  constructor() {
    this.items = [];
    this.activeCase = null;
    this.activeRarityFilter = null;
    this.spinning = false;
    this.activeSystemKey = 'mothership';
    this.inventory = this.loadInventory();
  }

  loadInventory() {
    return JSON.parse(localStorage.getItem(`inv_${this.activeSystemKey}`) || '[]');
  }

  saveInventory() {
    localStorage.setItem(`inv_${this.activeSystemKey}`, JSON.stringify(this.inventory));
    updateInventoryUI();
  }

  async switchSystem(key) {
    this.activeSystemKey = key;
    this.inventory = this.loadInventory();
    this.activeRarityFilter = null;
    
    const sys = SYSTEMS[key];
    document.body.className = sys.theme;
    $('#siteHeader').textContent = sys.label;
    
    const rawData = await Promise.all(
      sys.itemFiles.map(f => fetch(`./${f}`).then(r => r.json()).catch(() => []))
    );

    const flatItems = rawData.flat().map((item, i) => ({
      ...item,
      category: sys.itemFiles[i]?.includes('weapon') ? 'weapons' : 
                sys.itemFiles[i]?.includes('armor') ? 'armor' : 'equipment'
    }));

    this.items = this.autoAssignRarities(flatItems);
    renderAll();
  }

  autoAssignRarities(items) {
    const parseCost = (c) => typeof c === 'number' ? c : parseFloat(String(c).replace(/[^0-9.]/g, '')) || 0;
    const sorted = [...items].sort((a, b) => parseCost(a.cost) - parseCost(b.cost));
    const thresholds = [0.2, 0.4, 0.6, 0.8, 0.95, 1];
    
    return sorted.map((item, i) => {
      const p = i / sorted.length;
      item.rarity = RARITY_ORDER[thresholds.findIndex(t => p < t)];
      return item;
    });
  }
}

const state = new AppState();

function getItemHTML(item, isInv = false, idx = null) {
  const rar = RARITIES[item.rarity];
  const img = item.image ? `<img src="${item.image}" onerror="this.remove()">` : '';
  
  if (isInv) {
    return `
      <div class="inv-tile" style="border-color:${rar.color}">
        <div class="inv-tile-icon">${img}</div>
        <div class="inv-tile-name">${item.name}</div>
        <button class="inv-tile-delete" data-index="${idx}">×</button>
      </div>`;
  }
  return `
    <div class="loot-item">
      <div class="loot-item-icon">${img}</div>
      <div class="loot-item-name">${item.name}</div>
      <div style="color:${rar.color}">${rar.label}</div>
    </div>`;
}

function renderAll() {
  const sys = SYSTEMS[state.activeSystemKey];
  
  $('#caseSelectGrid').innerHTML = sys.cases.map(c => `
    <div class="case-tile" data-id="${c.id}" style="border-color:${c.color}">
      <div style="font-size:24px">📦</div>
      <div>${c.name}</div>
    </div>
  `).join('');

  $('#rarityTabs').innerHTML = RARITY_ORDER.map(r => 
    `<div class="rarity-tab ${r} ${state.activeRarityFilter === r ? 'active' : ''}" data-rarity="${r}"></div>`
  ).join('');

  renderLootPanel();
  updateInventoryUI();
}

function renderLootPanel() {
  const sys = SYSTEMS[state.activeSystemKey];
  let html = '';

  Object.keys(sys.categories).forEach(cat => {
    const filtered = state.items.filter(i => 
      (cat === 'weapons' ? i.category === 'weapons' : i.category === cat) &&
      (!state.activeRarityFilter || i.rarity === state.activeRarityFilter)
    );
    
    if (!filtered.length) return;
    html += `<div class="loot-category-header">${sys.categories[cat]}</div>
             <div class="loot-items-list">${filtered.map(i => getItemHTML(i)).join('')}</div>`;
  });

  $('#lootContent').innerHTML = html || '<div class="inv-empty">No items match filter</div>';
}

function updateInventoryUI() {
  $('#invCount').textContent = `${state.inventory.length} item${state.inventory.length === 1 ? '' : 's'}`;
  $('#invGrid').innerHTML = state.inventory.length 
    ? state.inventory.map((item, i) => getItemHTML(item, true, i)).join('')
    : '<div class="inv-empty">Inventory is empty</div>';
}

function spin() {
  if (state.spinning) return;
  state.spinning = true;

  const track = $('#reelTrack');
  const pool = state.items.filter(i => state.activeCase.pool.includes(i.rarity));
  const spinItems = Array.from({length: 100}, () => pool[Math.floor(Math.random() * pool.length)]);
  
  track.innerHTML = spinItems.map(item => `
    <div class="rc" style="--rc-col:${RARITIES[item.rarity].color}">
      <div class="rc-icon">${item.image ? `<img src="${item.image}">` : ''}</div>
      <div class="rc-name">${item.name}</div>
    </div>
  `).join('');

  const targetIdx = 85; 
  const finalX = -(targetIdx * 120 - ($('#reelWrap').offsetWidth / 2 - 60));
  
  $('#openBtn').hidden = $('#backBtn').hidden = true;
  $('#reelWrap').hidden = false;
  
  track.style.transition = 'none';
  track.style.transform = 'translateX(0)';
  
  setTimeout(() => {
    track.style.transition = 'transform 6s cubic-bezier(0.1, 0, 0.1, 1)';
    track.style.transform = `translateX(${finalX}px)`;
  }, 50);

  setTimeout(() => {
    const won = spinItems[targetIdx];
    state.inventory.push(won);
    state.saveInventory();
    showSplash(won);
    state.spinning = false;
  }, 6500);
}

function showSplash(item) {
  const splash = document.createElement('div');
  splash.className = 'splash-overlay';
  splash.style.background = RARITIES[item.rarity].color;
  splash.innerHTML = `
    <div class="splash-content">
      <div class="splash-name">${item.name}</div>
      <div class="splash-rarity">${RARITIES[item.rarity].label}</div>
    </div>`;
  document.body.appendChild(splash);
  
  const close = () => {
    splash.remove();
    $('#openBtn').hidden = $('#backBtn').hidden = false;
    $('#reelWrap').hidden = true;
  };
  splash.onclick = close;
  setTimeout(close, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  state.switchSystem('mothership');

  $('body').addEventListener('click', (e) => {
    const t = e.target;
    
    if (t.closest('.case-tile')) {
      const id = t.closest('.case-tile').dataset.id;
      state.activeCase = SYSTEMS[state.activeSystemKey].cases.find(c => c.id === id);
      $('#caseSelectGrid').hidden = true;
      $('#caseOpenContainer').hidden = false;
    }

    if (t.id === 'backBtn') {
      $('#caseSelectGrid').hidden = false;
      $('#caseOpenContainer').hidden = true;
    }

    if (t.id === 'openBtn') spin();

    if (t.closest('.rarity-tab')) {
      const r = t.closest('.rarity-tab').dataset.rarity;
      state.activeRarityFilter = state.activeRarityFilter === r ? null : r;
      renderAll();
    }

    if (t.closest('.inv-tile-delete')) {
      state.inventory.splice(t.closest('.inv-tile-delete').dataset.index, 1);
      state.saveInventory();
    }

    if (t.closest('.menu-item')) {
      const tab = t.closest('.menu-item').dataset.tab;
      $$('.content-panel').forEach(p => p.hidden = p.id !== `${tab}Panel`);
      $('#menuDropdown').hidden = true;
    }

    if (t.closest('.system-menu-item')) {
      state.switchSystem(t.closest('.system-menu-item').dataset.system);
    }
  });

  $('#menuBtn').onclick = () => $('#menuDropdown').hidden = !$('#menuDropdown').hidden;
  $('#siteHeader').onclick = () => $('#systemMenu').classList.toggle('show');
});
