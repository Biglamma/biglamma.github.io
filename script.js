// ----------------------
// DATA
// ----------------------

const ITEM_IMAGES = {
  crowbar_img: "",
  stun_baton_img: "",
  flare_gun_img: "",
  tranq_img: "",
  nail_gun_img: "",
  revolver_img: "",
  attire_img: "",
  smg_img: "",
  shotgun_img: "",
  pulse_img: "",
  grenade_img: "",
  vibechete_img: "",
  vaccsuit_img: "",
  sbd_img: "",
  flamethrower_img: "",
  laser_img: "",
  gpmg_img: "",
  hazard_img: "",
  smart_rifle_img: "",
  abd_img: "",
};

const RARITIES = {
  standard:   { label: 'Standard Issue',  color: '#4a9ab0', icon: '🔦', chance: 0.50 },
  military:   { label: 'Military Grade',  color: '#3a7cc0', icon: '🔫', chance: 0.30 },
  classified: { label: 'Classified',      color: '#8a4faa', icon: '🔥', chance: 0.15 },
  prototype:  { label: 'Prototype',       color: '#c03535', icon: '⚡', chance: 0.05 },
};

const CASES = [
  { id: 'c1', name: 'Teamster Cache',   icon: '📦', color: '#4a9ab0', pool: ['standard','military'] },
  { id: 'c2', name: 'Corp Requisition', icon: '🗃️', color: '#3a7cc0', pool: ['standard','military','classified'] },
  { id: 'c3', name: 'Marine Armory',    icon: '💼', color: '#8a4faa', pool: ['military','classified','prototype'] },
  { id: 'c4', name: 'Black Budget',     icon: '🎖️', color: '#c03535', pool: ['classified','prototype'] },
];

const ITEMS = [
  { id:'crowbar',    name:'Crowbar', rarity:'standard', imgKey: 'crowbar_img' },
  { id:'stun-baton', name:'Stun Baton', rarity:'standard', imgKey: 'stun_baton_img' },
  { id:'flare-gun',  name:'Flare Gun', rarity:'standard', imgKey: 'flare_gun_img' },
  { id:'tranq',      name:'Tranq Pistol', rarity:'standard', imgKey: 'tranq_img' },
  { id:'nail-gun',   name:'Nail Gun', rarity:'standard', imgKey: 'nail_gun_img' },
  { id:'revolver',   name:'FN Slug Revolver', rarity:'standard', imgKey: 'revolver_img' },
  { id:'attire',     name:'Standard Crew Attire', rarity:'standard', imgKey: 'attire_img' },
  { id:'smg',        name:'Arma 29 SMG', rarity:'military', imgKey: 'smg_img' },
  { id:'shotgun',    name:'Kano X9 Shotgun', rarity:'military', imgKey: 'shotgun_img' },
  { id:'pulse',      name:'F20 Arbiter Pulse', rarity:'military', imgKey: 'pulse_img' },
  { id:'grenade',    name:'Frag Grenade', rarity:'military', imgKey: 'grenade_img' },
  { id:'vibechete',  name:'Vibechete', rarity:'military', imgKey: 'vibechete_img' },
  { id:'vaccsuit',   name:'Valecore Mk2 Vaccsuit', rarity:'military', imgKey: 'vaccsuit_img' },
  { id:'sbd',        name:'Standard Battle Dress', rarity:'military', imgKey: 'sbd_img' },
  { id:'flamethrower',name:'Ramhorn 1 Flamer', rarity:'classified', imgKey: 'flamethrower_img' },
  { id:'laser',      name:'MNC Mode A Laser', rarity:'classified', imgKey: 'laser_img' },
  { id:'gpmg',       name:'GP Machine Gun', rarity:'classified', imgKey: 'gpmg_img' },
  { id:'hazard',     name:'Hazard Suit', rarity:'classified', imgKey: 'hazard_img' },
  { id:'smart-rifle',name:'SK 109 Smart Rifle', rarity:'prototype', imgKey: 'smart_rifle_img' },
  { id:'abd',        name:'Armadyne Heavy-K ABD', rarity:'prototype', imgKey: 'abd_img' },
];

let activeCase = CASES[0];
let spinning = false;
let inventory = [];

// ----------------------
// MENU
// ----------------------

document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('menuDropdown').classList.toggle('show');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#menuBtn') && !e.target.closest('.menu-dropdown')) {
    document.getElementById('menuDropdown').classList.remove('show');
  }
});

// ----------------------
// TABS
// ----------------------

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

// ----------------------
// LOOT PANEL
// ----------------------

function renderLootPanel() {
  const content = document.getElementById('lootContent');
  let html = '';

  Object.entries(RARITIES).forEach(([key, rar]) => {
    const items = ITEMS.filter(i => i.rarity === key);
    html += `
      <div class="loot-group">
        <div class="loot-group-title">
          <div class="loot-group-col" style="background:${rar.color}"></div>
          ${rar.label} (${Math.round(rar.chance * 100)}%)
        </div>
        <div class="loot-items">
          ${items.map(i => `<div class="loot-item">${i.name}</div>`).join('')}
        </div>
      </div>`;
  });

  content.innerHTML = html;
}

// ----------------------
// CASE NAV
// ----------------------

function renderCaseNav() {
  const nav = document.getElementById('caseNav');

  nav.innerHTML = CASES.map(c => `
    <button class="case-tab ${c.id === activeCase.id ? 'active' : ''}"
      style="--case-col:${c.color}"
      data-case="${c.id}">
      <span class="case-icon">${c.icon}</span>
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
  document.getElementById('openBtnIcon').textContent = activeCase.icon;
  buildReel();
}

// ----------------------
// ROLLING LOGIC
// ----------------------

function rollRarity(pool) {
  const eligible = pool.map(id => ({ id, ...RARITIES[id] }));
  const total = eligible.reduce((s, r) => s + r.chance, 0);
  let roll = Math.random() * total;

  for (const r of eligible) {
    roll -= r.chance;
    if (roll <= 0) return r.id;
  }
  return eligible[eligible.length - 1].id;
}

function pickItem(pool) {
  const rarity = rollRarity(pool);
  const candidates = ITEMS.filter(i => i.rarity === rarity);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function makeReelCell(item) {
  const rar = RARITIES[item.rarity];
  const div = document.createElement('div');
  div.className = 'rc';
  div.style.setProperty('--rc-col', rar.color);
  div.innerHTML = `
    <div class="rc-icon">${rar.icon}</div>
    <div class="rc-name">${item.name}</div>
    <div class="rc-bar"></div>`;
  return div;
}

function buildReel() {
  const track = document.getElementById('reelTrack');
  track.style.transition = 'none';
  track.style.transform = 'translateX(0)';
  track.innerHTML = '';

  const cells = [];
  for (let i = 0; i < 70; i++) {
    const item = pickItem(activeCase.pool);
    cells.push(item);
    track.appendChild(makeReelCell(item));
  }
  track._cells = cells;
}

// ----------------------
// OPENING / SPINNING
// ----------------------

document.getElementById('openBtn').addEventListener('click', openBox);

function openBox() {
  if (spinning) return;

  const openBtn = document.getElementById('openBtn');
  const reelWrap = document.getElementById('reelWrap');
  const resultPanel = document.getElementById('resultPanel');

  openBtn.style.display = 'none';
  reelWrap.classList.add('show');
  resultPanel.classList.remove('show');

  setTimeout(spin, 500);
}

function spin() {
  spinning = true;

  const reelWrap = document.getElementById('reelWrap');
  const track = document.getElementById('reelTrack');
  const cells = track._cells;

  const CELL_W = 110;
  const wrapW = reelWrap.offsetWidth;
  const center = wrapW / 2;

  const targetIdx = 50 + Math.floor(Math.random() * 12);
  const drift = (Math.random() - 0.5) * 44;
  const finalX = -(targetIdx * CELL_W + CELL_W / 2 - center + drift);

  void track.offsetWidth;

  const dur = 3200 + Math.random() * 800;
  track.style.transition = `transform ${dur}ms cubic-bezier(0.08, 0.92, 0.22, 1.0)`;
  track.style.transform = `translateX(${finalX}px)`;

  setTimeout(() => {
    const won = cells[targetIdx];
    reelWrap.classList.remove('show');
    showResult(won);
    addToInventory(won);

    // 🔥 FIX: Bring back the button so you can open again
    const openBtn = document.getElementById('openBtn');
    openBtn.style.display = 'block';

    spinning = false;
  }, dur + 300);
}

// ----------------------
// RESULT PANEL
// ----------------------

function showResult(item) {
  const rar = RARITIES[item.rarity];
  const col = rar.color;

  document.getElementById('resultStripe').style.background = col;
  document.getElementById('resultGlow').style.background = `radial-gradient(circle, ${col} 0%, transparent 70%)`;
  document.getElementById('resultRarity').textContent = rar.label;
  document.getElementById('resultRarity').style.color = col;
  document.getElementById('resultName').textContent = item.name;
  document.getElementById('resultIcon').textContent = rar.icon;
  document.getElementById('resultDesc').textContent = 'Item acquired and added to inventory.';

  const wrap = document.getElementById('resultImgWrap');
  wrap.style.setProperty('--rarity-col', col);

  const panel = document.getElementById('resultPanel');
  panel.classList.add('show');

  // Optional: auto-hide result after 2.5s
  setTimeout(() => {
    panel.classList.remove('show');
  }, 2500);
}

// ----------------------
// INVENTORY
// ----------------------

function addToInventory(item) {
  const invItem = { ...item, id: Date.now() + Math.random() };
  inventory.unshift(invItem);
  updateInventory();
}

function updateInventory() {
  const grid = document.getElementById('invGrid');
  const count = document.getElementById('invCount');

  count.textContent = inventory.length;

  if (!inventory.length) {
    grid.innerHTML = '<div class="inv-empty">No items yet</div>';
    return;
  }

  grid.innerHTML = inventory.map(item => {
    const rar = RARITIES[item.rarity];
    return `
      <div class="inv-item" style="--rarity-col:${rar.color}" data-id="${item.id}">
        <button class="delete-x">×</button>
        <div class="inv-icon">${rar.icon}</div>
        <div class="inv-name">${item.name}</div>
        <div class="inv-rar">${rar.label}</div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.delete-x').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = Number(btn.closest('.inv-item').dataset.id);
      removeFromInventory(id);
    });
  });
}

function removeFromInventory(id) {
  inventory = inventory.filter(i => i.id !== id);
  updateInventory();
}

// ----------------------
// INIT
// ----------------------

renderCaseNav();
buildReel();
updateInventory();
