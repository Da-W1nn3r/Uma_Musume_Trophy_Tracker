const STORAGE_KEY = 'uma-race-tracker-completed';
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const YEAR_NAMES = { 1: 'Junior Year', 2: 'Classic Year', 3: 'Senior Year' };

let races = [];
let raceById = new Map();
let trophyRoom = null;
let completed = new Set();
let currentView = 'calendar';
let currentYear = 1;
let searchTerm = '';
let activeGrades = new Set(['G1', 'G2', 'G3']);
let trophyGrade = 'G1';
let trophyPage = 0;

async function init() {
  const [racesRes, trophyRes] = await Promise.all([
    fetch('data/races.json'),
    fetch('data/trophy-room.json'),
  ]);
  races = await racesRes.json();
  trophyRoom = await trophyRes.json();
  raceById = new Map(races.map(r => [r.id, r]));
  loadCompleted();
  render();

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.querySelectorAll('.year-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentYear = Number(btn.dataset.year);
      document.querySelectorAll('.year-tab').forEach(b => b.classList.toggle('active', b === btn));
      renderCalendar();
    });
  });
  document.querySelectorAll('.trophy-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      trophyGrade = btn.dataset.grade;
      trophyPage = 0;
      document.querySelectorAll('.trophy-tab').forEach(b => b.classList.toggle('active', b === btn));
      renderTrophyRoom();
    });
  });
  document.getElementById('trophy-prev').addEventListener('click', () => {
    trophyPage -= 1;
    renderTrophyRoom();
  });
  document.getElementById('trophy-next').addEventListener('click', () => {
    trophyPage += 1;
    renderTrophyRoom();
  });
  document.getElementById('search-input').addEventListener('input', e => {
    searchTerm = e.target.value.trim().toLowerCase();
    if (searchTerm) setView('list');
    renderActiveView();
  });
  document.querySelectorAll('.grade-filter').forEach(cb => {
    cb.addEventListener('change', () => {
      activeGrades = new Set(
        [...document.querySelectorAll('.grade-filter')].filter(c => c.checked).map(c => c.value)
      );
      renderActiveView();
    });
  });
  document.getElementById('export-btn').addEventListener('click', exportChecklist);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importChecklist);
  document.getElementById('clear-btn').addEventListener('click', clearChecklist);
}

function loadCompleted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) completed = new Set(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not load saved checklist', e);
  }
}

function saveCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  } catch (e) {
    console.warn('Could not save checklist', e);
  }
}

function toggleRace(id) {
  const wasChecking = !completed.has(id);
  if (completed.has(id)) completed.delete(id);
  else completed.add(id);
  saveCompleted();
  renderActiveView();
  renderProgress();
  if (wasChecking && completed.size === races.length) {
    celebrate();
  }
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('calendar-view').classList.toggle('hidden', view !== 'calendar');
  document.getElementById('list-view').classList.toggle('hidden', view !== 'list');
  document.getElementById('trophy-view').classList.toggle('hidden', view !== 'trophy');
  document.getElementById('search-input').closest('.search-wrap').classList.toggle('hidden', view === 'trophy');
  document.getElementById('grade-filters').classList.toggle('hidden', view === 'trophy');
  renderActiveView();
}

function renderActiveView() {
  if (currentView === 'calendar') renderCalendar();
  else if (currentView === 'trophy') renderTrophyRoom();
  else renderList();
}

function render() {
  renderProgress();
  renderCalendar();
  renderList();
  renderTrophyRoom();
}

function clearChecklist() {
  if (completed.size === 0) return;
  const ok = confirm(`Clear all ${completed.size} checked race${completed.size === 1 ? '' : 's'}? This cannot be undone.`);
  if (!ok) return;
  completed.clear();
  saveCompleted();
  render();
}

function celebrate() {
  const overlay = document.getElementById('celebration-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = '<div class="celebration-banner">🏆 Trophy Room Complete! 🏆</div>';

  const colors = ['#f4c542', '#e8590c', '#3b5bdb', '#2f8a4b', '#e64980'];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 1.4}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    overlay.appendChild(piece);
  }

  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }, 3800);
}

function renderProgress() {
  const visible = races.filter(r => activeGrades.has(r.grade));
  const done = visible.filter(r => completed.has(r.id)).length;
  const byGrade = ['G1', 'G2', 'G3'].map(g => {
    const total = races.filter(r => r.grade === g).length;
    const gdone = races.filter(r => r.grade === g && completed.has(r.id)).length;
    return `${g}: ${gdone}/${total}`;
  }).join(' · ');
  document.getElementById('progress').textContent = `${done} / ${visible.length} complete  (${byGrade})`;
}

function matchesFilters(race) {
  if (!activeGrades.has(race.grade)) return false;
  if (!searchTerm) return true;
  const haystack = [
    race.name, race.track, race.surface, race.grade, String(race.distance),
  ].join(' ').toLowerCase();
  return haystack.includes(searchTerm);
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const slots = [];
  for (let q = 0; q < 4; q++) {
    for (let m = q * 3 + 1; m <= q * 3 + 3; m++) {
      slots.push({ month: m, half: 1 });
      slots.push({ month: m, half: 2 });
    }
  }

  for (const slot of slots) {
    const tile = document.createElement('div');
    tile.className = 'calendar-tile';

    const label = document.createElement('div');
    label.className = 'tile-label';
    label.textContent = `${slot.half === 1 ? 'Early' : 'Late'} ${MONTH_NAMES[slot.month]}`;
    tile.appendChild(label);

    const slotRaces = races.filter(r =>
      matchesFilters(r) &&
      r.occurrences.some(o => o.year === currentYear && o.month === slot.month && o.half === slot.half)
    );

    if (slotRaces.length === 0) {
      tile.classList.add('empty');
    } else {
      const list = document.createElement('div');
      list.className = 'tile-races';
      for (const race of slotRaces) {
        list.appendChild(buildRaceEntry(race, 'tile'));
      }
      tile.appendChild(list);
    }

    grid.appendChild(tile);
  }
}

function renderList() {
  const container = document.getElementById('list-container');
  container.innerHTML = '';

  const filtered = races.filter(matchesFilters);

  if (filtered.length === 0) {
    container.innerHTML = '<p class="no-results">No races match your search.</p>';
    return;
  }

  for (const race of filtered) {
    container.appendChild(buildRaceEntry(race, 'list'));
  }
}

function getTrophyPagesForGrade(grade) {
  const { g1End, g2End } = trophyRoom.gradeBoundary;
  if (grade === 'G1') return trophyRoom.pages.slice(0, g1End);
  if (grade === 'G2') return trophyRoom.pages.slice(g1End, g2End);
  return trophyRoom.pages.slice(g2End);
}

function renderTrophyRoom() {
  if (!trophyRoom) return;

  const pages = getTrophyPagesForGrade(trophyGrade);
  if (trophyPage < 0) trophyPage = 0;
  if (trophyPage > pages.length - 1) trophyPage = pages.length - 1;

  document.getElementById('trophy-page-label').textContent = `Page ${trophyPage + 1} of ${pages.length}`;
  document.getElementById('trophy-prev').disabled = trophyPage === 0;
  document.getElementById('trophy-next').disabled = trophyPage === pages.length - 1;

  const pageEl = document.getElementById('trophy-page');
  pageEl.innerHTML = '';
  pageEl.className = `trophy-page grade-${trophyGrade}`;

  const slots = pages[trophyPage] || [];
  for (const raceId of slots) {
    if (raceId === null) {
      const empty = document.createElement('div');
      empty.className = 'trophy-slot empty';
      pageEl.appendChild(empty);
      continue;
    }
    const race = raceById.get(raceId);
    pageEl.appendChild(buildTrophyEntry(race));
  }
}

function buildTrophyEntry(race) {
  const isDone = completed.has(race.id);
  const slot = document.createElement('label');
  slot.className = `trophy-slot grade-${race.grade}` + (isDone ? ' completed' : '');

  const medal = document.createElement('span');
  medal.className = 'trophy-medal';
  medal.textContent = '🏆';
  slot.appendChild(medal);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isDone;
  checkbox.addEventListener('change', () => toggleRace(race.id));
  slot.appendChild(checkbox);

  const name = document.createElement('span');
  name.className = 'trophy-name';
  name.textContent = race.name;
  slot.appendChild(name);

  return slot;
}

function buildRaceEntry(race, mode) {
  const row = document.createElement('label');
  row.className = `race-entry ${mode} grade-${race.grade}` + (completed.has(race.id) ? ' completed' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = completed.has(race.id);
  checkbox.addEventListener('change', () => toggleRace(race.id));
  row.appendChild(checkbox);

  const badge = document.createElement('span');
  badge.className = `grade-badge grade-${race.grade}`;
  badge.textContent = race.grade;
  row.appendChild(badge);

  const info = document.createElement('span');
  info.className = 'race-info';
  const name = document.createElement('span');
  name.className = 'race-name';
  name.textContent = race.name;
  info.appendChild(name);

  if (mode === 'list') {
    const meta = document.createElement('span');
    meta.className = 'race-meta';
    const occText = race.occurrences
      .map(o => `${YEAR_NAMES[o.year] || 'Year ' + o.year} ${o.half === 1 ? 'Early' : 'Late'} ${MONTH_NAMES[o.month]}`)
      .join(', ');
    meta.textContent = `${race.track} · ${race.surface} ${race.distance}m · ${occText}`;
    info.appendChild(meta);
  } else {
    const meta = document.createElement('span');
    meta.className = 'race-meta';
    meta.textContent = `${race.track} · ${race.distance}m`;
    info.appendChild(meta);
  }

  row.appendChild(info);
  return row;
}

function exportChecklist() {
  const payload = {
    completed: [...completed],
    savedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'uma-race-checklist.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importChecklist(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.completed)) throw new Error('Invalid checklist file');
      completed = new Set(data.completed);
      saveCompleted();
      render();
    } catch (err) {
      alert('Could not load that file: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

init();
