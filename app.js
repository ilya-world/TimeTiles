const TOTAL_TILES = 144;
const TILE_MINUTES = 10;
const STORAGE_KEY = 'timetiles-state-v1';

const defaultColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#f87171', '#10b981', '#2dd4bf', '#64748b'
];

const els = {
  grid: document.getElementById('grid'),
  dayList: document.getElementById('dayList'),
  selectedDayTitle: document.getElementById('selectedDayTitle'),
  toggleTimeLabels: document.getElementById('toggleTimeLabels'),
  toggleTheme: document.getElementById('toggleTheme'),
  selectedTileTime: document.getElementById('selectedTileTime'),
  selectedActivityName: document.getElementById('selectedActivityName'),
  clearSelectedActivity: document.getElementById('clearSelectedActivity'),
  selectedComment: document.getElementById('selectedComment'),
  groupsContainer: document.getElementById('groupsContainer'),
  addGroupBtn: document.getElementById('addGroupBtn'),
  addUngroupedActivityBtn: document.getElementById('addUngroupedActivityBtn'),
  palette: document.getElementById('palette'),
  customColorPicker: document.getElementById('customColorPicker'),
  tooltip: document.getElementById('tooltip'),
  importModal: document.getElementById('importModal'),
  openImportModal: document.getElementById('openImportModal'),
  importForm: document.getElementById('importForm'),
  importText: document.getElementById('importText')
};

const state = loadState();
let isPainting = false;

init();

function init() {
  ensureToday();
  renderPalette();
  bindGlobalEvents();
  renderAll();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  const today = dayKey(new Date());
  return {
    settings: { showTimeLabels: true, darkMode: false },
    selectedDay: today,
    selectedTile: null,
    selectedBrushId: null,
    groups: [],
    activities: [],
    days: { [today]: createEmptyDay() }
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createEmptyDay() {
  return Array.from({ length: TOTAL_TILES }, () => ({ activityId: null, comment: '' }));
}

function ensureToday() {
  const today = dayKey(new Date());
  if (!state.days[today]) state.days[today] = createEmptyDay();
  state.selectedDay = state.days[state.selectedDay] ? state.selectedDay : today;
}

function renderAll() {
  document.body.classList.toggle('dark', state.settings.darkMode);
  els.toggleTheme.checked = state.settings.darkMode;
  els.toggleTimeLabels.checked = state.settings.showTimeLabels;
  renderDayList();
  renderGrid();
  renderSelectionPanel();
  renderGroups();
  saveState();
}

function renderDayList() {
  const keys = Object.keys(state.days).sort((a, b) => b.localeCompare(a));
  els.dayList.innerHTML = '';

  const today = dayKey(new Date());
  keys.forEach((key) => {
    if (key > today) return;
    const btn = document.createElement('button');
    const isCurrent = key === today;
    btn.className = `day-button ${isCurrent ? 'current' : ''} ${state.selectedDay === key ? 'active' : ''}`;
    btn.textContent = `${isCurrent ? 'Сегодня' : formatDay(key)} (${key})`;
    btn.onclick = () => {
      state.selectedDay = key;
      state.selectedTile = null;
      renderAll();
    };
    els.dayList.appendChild(btn);
  });

  els.selectedDayTitle.textContent = state.selectedDay === today ? 'Сегодня' : formatDay(state.selectedDay);
}

function renderGrid() {
  const dayData = state.days[state.selectedDay];
  const now = new Date();
  const currentDay = dayKey(now);
  const currentTile = currentDay === state.selectedDay ? toTileIndex(now) : -1;
  els.grid.innerHTML = '';

  for (let i = 0; i < TOTAL_TILES; i++) {
    const cellData = dayData[i];
    const activity = state.activities.find((a) => a.id === cellData.activityId) || null;
    const tile = document.createElement('button');
    tile.className = 'tile';
    if (i < currentTile) tile.classList.add('past');
    if (i === currentTile) tile.classList.add('current');
    if (state.selectedTile === i) tile.classList.add('selected');
    if (i > currentTile && activity) tile.classList.add('future');
    tile.style.setProperty('--activity-color', activity?.color || '#cbd5e1');
    if (activity) tile.style.background = activity.color;

    const leftSame = i % 12 !== 0 && isSameTileMeta(dayData[i - 1], cellData);
    const rightSame = i % 12 !== 11 && isSameTileMeta(dayData[i + 1], cellData);
    if (leftSame) tile.classList.add('connected-left');
    if (rightSame) tile.classList.add('connected-right');

    const [start, end] = tileRange(i);
    tile.dataset.tooltip = `${start}-${end}\n${activity ? activity.name : 'Без активности'}\n${cellData.comment || 'Без комментария'}`;

    if (state.settings.showTimeLabels) {
      const tt = document.createElement('div');
      tt.className = 'tile-time';
      const [h, m] = start.split(':');
      tt.innerHTML = `<div>${h}</div><div>${m}</div>`;
      tile.appendChild(tt);
    }

    if (activity) {
      const label = document.createElement('div');
      label.className = 'tile-label';
      label.textContent = activity.name;
      tile.appendChild(label);
    }

    tile.addEventListener('click', (e) => {
      state.selectedTile = i;
      if (state.selectedBrushId) applyBrush(i);
      renderAll();
      e.stopPropagation();
    });

    tile.addEventListener('mousedown', () => {
      isPainting = true;
      if (state.selectedBrushId) {
        applyBrush(i);
        state.selectedTile = i;
        renderAll();
      }
    });

    tile.addEventListener('mouseenter', (e) => {
      showTooltip(e, tile.dataset.tooltip);
      if (isPainting && state.selectedBrushId) {
        applyBrush(i);
        state.selectedTile = i;
        renderAll();
      }
    });
    tile.addEventListener('mousemove', (e) => moveTooltip(e));
    tile.addEventListener('mouseleave', hideTooltip);

    els.grid.appendChild(tile);
  }
}

function renderSelectionPanel() {
  if (state.selectedTile == null) {
    els.selectedTileTime.textContent = '—';
    els.selectedActivityName.textContent = 'Не выбрана';
    els.selectedComment.value = '';
    els.selectedComment.disabled = true;
    els.clearSelectedActivity.disabled = true;
    return;
  }
  els.selectedComment.disabled = false;
  els.clearSelectedActivity.disabled = false;
  const dayData = state.days[state.selectedDay];
  const tile = dayData[state.selectedTile];
  const activity = state.activities.find((a) => a.id === tile.activityId);
  const [start, end] = tileRange(state.selectedTile);
  els.selectedTileTime.textContent = `${start}–${end}`;
  els.selectedActivityName.textContent = activity ? activity.name : 'Не задана';
  els.selectedComment.value = tile.comment || '';
}

function renderGroups() {
  const groupTpl = document.getElementById('groupTemplate');
  const activityTpl = document.getElementById('activityTemplate');
  els.groupsContainer.innerHTML = '';

  const ungrouped = state.activities.filter((a) => !a.groupId);
  if (ungrouped.length) {
    const block = document.createElement('article');
    block.className = 'group-card';
    block.innerHTML = '<strong>Без группы</strong><div class="activities"></div>';
    const box = block.querySelector('.activities');
    ungrouped.forEach((a) => box.appendChild(renderActivityNode(a, activityTpl)));
    els.groupsContainer.appendChild(block);
  }

  state.groups.forEach((group) => {
    const node = groupTpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.group-name').value = group.name;
    node.querySelector('.group-color').value = group.color;
    node.querySelector('.group-name').oninput = (e) => { group.name = e.target.value; renderAll(); };
    node.querySelector('.group-color').oninput = (e) => { group.color = e.target.value; renderAll(); };
    node.querySelector('.delete-group').onclick = () => {
      state.activities.forEach((a) => { if (a.groupId === group.id) a.groupId = null; });
      state.groups = state.groups.filter((g) => g.id !== group.id);
      renderAll();
    };
    node.querySelector('.add-activity-in-group').onclick = () => {
      createActivity(group.id, group.color);
      renderAll();
    };

    const activitiesBox = node.querySelector('.activities');
    state.activities.filter((a) => a.groupId === group.id).forEach((a) => {
      activitiesBox.appendChild(renderActivityNode(a, activityTpl));
    });

    els.groupsContainer.appendChild(node);
  });
}

function renderActivityNode(activity, tpl) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  const brush = node.querySelector('.brush-button');
  brush.style.background = activity.color;
  brush.classList.toggle('selected', state.selectedBrushId === activity.id);
  brush.onclick = () => {
    state.selectedBrushId = state.selectedBrushId === activity.id ? null : activity.id;
    renderAll();
  };

  const nameInput = node.querySelector('.activity-name');
  nameInput.value = activity.name;
  nameInput.oninput = (e) => { activity.name = e.target.value; renderAll(); };

  const colorInput = node.querySelector('.activity-color');
  colorInput.value = activity.color;
  colorInput.oninput = (e) => { activity.color = e.target.value; renderAll(); };

  node.querySelector('.delete-activity').onclick = () => {
    state.activities = state.activities.filter((a) => a.id !== activity.id);
    Object.values(state.days).forEach((day) => day.forEach((tile) => {
      if (tile.activityId === activity.id) tile.activityId = null;
    }));
    if (state.selectedBrushId === activity.id) state.selectedBrushId = null;
    renderAll();
  };
  return node;
}

function bindGlobalEvents() {
  els.toggleTheme.onchange = (e) => { state.settings.darkMode = e.target.checked; renderAll(); };
  els.toggleTimeLabels.onchange = (e) => { state.settings.showTimeLabels = e.target.checked; renderAll(); };

  els.addGroupBtn.onclick = () => {
    state.groups.push({ id: uid(), name: 'Новая группа', color: els.customColorPicker.value });
    renderAll();
  };

  els.addUngroupedActivityBtn.onclick = () => {
    createActivity(null, els.customColorPicker.value);
    renderAll();
  };

  els.customColorPicker.oninput = () => {
    [...els.palette.children].forEach((n) => n.classList.remove('active'));
  };

  els.clearSelectedActivity.onclick = () => {
    if (state.selectedTile == null) return;
    const tile = state.days[state.selectedDay][state.selectedTile];
    tile.activityId = null;
    renderAll();
  };

  els.selectedComment.addEventListener('input', (e) => {
    if (state.selectedTile == null) return;
    state.days[state.selectedDay][state.selectedTile].comment = e.target.value;
    saveState();
  });


  els.openImportModal.onclick = () => els.importModal.showModal();

  document.addEventListener('mouseup', () => { isPainting = false; });

  els.importForm.addEventListener('submit', (e) => {
    e.preventDefault();
    importMeetings(els.importText.value);
    els.importText.value = '';
    els.importModal.close();
    renderAll();
  });
}

function renderPalette() {
  els.palette.innerHTML = '';
  defaultColors.forEach((color) => {
    const b = document.createElement('button');
    b.className = 'palette-color';
    b.style.background = color;
    b.onclick = () => {
      els.customColorPicker.value = color;
      [...els.palette.children].forEach((n) => n.classList.remove('active'));
      b.classList.add('active');
    };
    els.palette.appendChild(b);
  });
}

function createActivity(groupId = null, color = '#3b82f6') {
  state.activities.push({
    id: uid(),
    name: 'Новая активность',
    color,
    groupId
  });
}

function applyBrush(tileIndex) {
  if (state.selectedBrushId == null) return;
  const tile = state.days[state.selectedDay][tileIndex];
  tile.activityId = state.selectedBrushId;
}

function importMeetings(text) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let meetingActivity = state.activities.find((a) => a.name === 'Встреча' && a.color.toUpperCase() === '#0000FF');
  if (!meetingActivity) {
    meetingActivity = { id: uid(), name: 'Встреча', color: '#0000FF', groupId: null };
    state.activities.push(meetingActivity);
  }

  lines.forEach((line) => {
    const m = line.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})\s+(.+)$/);
    if (!m) return;
    const [, start, end, title] = m;
    const startIdx = timeToTile(start);
    const endIdx = Math.min(TOTAL_TILES, timeToTile(end, true));
    for (let i = startIdx; i < endIdx; i++) {
      const tile = state.days[state.selectedDay][i];
      tile.activityId = meetingActivity.id;
      tile.comment = title;
    }
  });
}

function tileRange(index) {
  const start = minutesToTime(index * TILE_MINUTES);
  const end = minutesToTime((index + 1) * TILE_MINUTES);
  return [start, end];
}

function toTileIndex(date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return Math.floor(minutes / TILE_MINUTES);
}

function timeToTile(time, ceil = false) {
  const [h, m] = time.split(':').map(Number);
  const minutes = h * 60 + m;
  return ceil ? Math.ceil(minutes / TILE_MINUTES) : Math.floor(minutes / TILE_MINUTES);
}

function minutesToTime(totalMinutes) {
  const normalized = totalMinutes % (24 * 60);
  const h = Math.floor(normalized / 60).toString().padStart(2, '0');
  const m = (normalized % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDay(key) {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function isSameTileMeta(a, b) {
  return a && b && a.activityId && a.activityId === b.activityId && (a.comment || '') === (b.comment || '');
}

function showTooltip(e, text) {
  els.tooltip.style.display = 'block';
  els.tooltip.textContent = text;
  moveTooltip(e);
}

function moveTooltip(e) {
  els.tooltip.style.left = `${e.clientX + 12}px`;
  els.tooltip.style.top = `${e.clientY + 12}px`;
}

function hideTooltip() {
  els.tooltip.style.display = 'none';
}
