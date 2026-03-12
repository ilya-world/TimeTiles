const TOTAL_TILES = 144;
const TILE_MINUTES = 10;
const REFRESH_INTERVAL_MS = 30000;

const els = {
  grid: document.getElementById('shareGrid'),
  tooltip: document.getElementById('shareTooltip'),
  status: document.getElementById('shareStatus')
};

const state = {
  profile: null,
  token: null,
  refreshTimer: null,
  tickTimer: null,
  currentTile: -1
};

init();

function init() {
  const params = new URLSearchParams(window.location.search);
  state.token = params.get('token') || '';

  if (!state.token) {
    setStatus('Некорректная ссылка матрицы', true);
    return;
  }

  fetchProfile(true);
  state.refreshTimer = setInterval(() => fetchProfile(false), REFRESH_INTERVAL_MS);
  startCurrentTileRefresh();
}

function startCurrentTileRefresh() {
  const tick = () => {
    const nextCurrentTile = toTileIndex(new Date());
    if (nextCurrentTile !== state.currentTile) {
      state.currentTile = nextCurrentTile;
      renderGrid();
    }
    scheduleNextTick();
  };

  const scheduleNextTick = () => {
    if (state.tickTimer) clearTimeout(state.tickTimer);
    const now = new Date();
    const msSinceHourStart = (now.getMinutes() * 60 + now.getSeconds()) * 1000 + now.getMilliseconds();
    const tileDurationMs = TILE_MINUTES * 60 * 1000;
    const msUntilNextTile = tileDurationMs - (msSinceHourStart % tileDurationMs);
    state.tickTimer = setTimeout(tick, msUntilNextTile + 50);
  };

  state.currentTile = toTileIndex(new Date());
  scheduleNextTick();
}

async function fetchProfile(showInitialError) {
  try {
    const data = await apiRequest(`api/share.php?token=${encodeURIComponent(state.token)}`);
    state.profile = data.profile;
    renderGrid();
    setStatus('');
  } catch (err) {
    if (showInitialError) {
      setStatus(err.message || 'Не удалось загрузить матрицу', true);
    }
  }
}

function renderGrid() {
  els.grid.innerHTML = '';
  const profile = state.profile;
  if (!profile || !profile.days || !profile.selectedDay) return;

  const settings = normalizeSettings(profile.settings || {});
  document.body.classList.toggle('dark', Boolean(settings.darkMode));

  const today = dayKey(new Date());
  const day = profile.days[today] || profile.days[profile.selectedDay] || null;
  if (!Array.isArray(day)) return;

  const activitiesById = new Map((profile.activities || []).map((a) => [a.id, a]));
  const morningHour = Number(profile.daySettings?.[today]?.morningLineHour ?? profile.daySettings?.[profile.selectedDay]?.morningLineHour ?? null);

  for (let i = 0; i < TOTAL_TILES; i++) {
    const cellData = day[i] || { activityId: null, comment: '' };
    const activity = activitiesById.get(cellData.activityId) || null;
    const tile = document.createElement('div');
    tile.className = 'tile';

    if (settings.dimPastTiles && i < state.currentTile) tile.classList.add('past');
    if (i === state.currentTile) tile.classList.add('current');
    if (i > state.currentTile && activity) tile.classList.add('future');

    tile.style.setProperty('--activity-color', activity?.color || '#cbd5e1');
    if (activity) tile.style.background = activity.color;

    const leftSame = i % 12 !== 0 && isSameTileMeta(day[i - 1], cellData);
    const rightSame = i % 12 !== 11 && isSameTileMeta(day[i + 1], cellData);
    const upSame = i >= 12 && isSameTileMeta(day[i - 12], cellData);
    const downSame = i < TOTAL_TILES - 12 && isSameTileMeta(day[i + 12], cellData);

    if (leftSame) tile.classList.add('connected-left');
    if (rightSame) tile.classList.add('connected-right');
    if (settings.connectTiles) {
      if (rightSame) tile.classList.add('joined-right');
      if (downSame) tile.classList.add('joined-down');
      if (leftSame || rightSame || upSame || downSame) {
        tile.style.setProperty('--join-color', activity ? lightenColor(activity.color, 0.3) : '#e2e8f0');
      }
    }

    const [start, end] = tileRange(i);
    const tooltipLines = [`${start}-${end}`, activity ? activity.name : 'Без активности'];
    if (cellData.comment) tooltipLines.push(cellData.comment);
    tile.dataset.tooltip = tooltipLines.join('\n');

    if (settings.showTimeLabels) {
      const tt = document.createElement('div');
      tt.className = 'tile-time';
      const [h, m] = start.split(':');
      tt.innerHTML = `<div>${h}</div><div>${m}</div>`;
      tile.appendChild(tt);
    }

    if (activity && settings.showActivityLabels) {
      const label = document.createElement('div');
      label.className = 'tile-label';
      label.textContent = activity.name;
      tile.appendChild(label);
    }

    tile.addEventListener('mouseenter', (e) => showTooltip(e, tile.dataset.tooltip));
    tile.addEventListener('mousemove', (e) => moveTooltip(e));
    tile.addEventListener('mouseleave', hideTooltip);

    els.grid.appendChild(tile);
  }

  renderMorningLine(morningHour);
}

function renderMorningLine(morningHour) {
  if (![6, 8, 10, 12].includes(morningHour)) return;

  const rowStart = morningHour / 2;
  if (rowStart < 1 || rowStart > 11) return;

  const prevRowTile = els.grid.children[(rowStart - 1) * 12];
  const nextRowTile = els.grid.children[rowStart * 12];
  if (!prevRowTile || !nextRowTile) return;

  const line = document.createElement('div');
  line.className = 'morning-line';
  const top = (prevRowTile.offsetTop + prevRowTile.offsetHeight + nextRowTile.offsetTop) / 2;
  line.style.top = `${top - 1}px`;
  els.grid.appendChild(line);
}

function normalizeSettings(settings) {
  return {
    darkMode: Boolean(settings.darkMode),
    dimPastTiles: settings.dimPastTiles !== false,
    showTimeLabels: settings.showTimeLabels !== false,
    showActivityLabels: settings.showActivityLabels !== false,
    connectTiles: settings.connectTiles !== false
  };
}

async function apiRequest(url) {
  const response = await fetch(url, { credentials: 'omit' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function setStatus(message, show = false) {
  els.status.hidden = !show;
  els.status.textContent = message || '';
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

function toTileIndex(date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return Math.floor(minutes / TILE_MINUTES);
}

function tileRange(index) {
  const start = minutesToTime(index * TILE_MINUTES);
  const end = minutesToTime((index + 1) * TILE_MINUTES);
  return [start, end];
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

function isSameTileMeta(a, b) {
  return a && b && a.activityId && a.activityId === b.activityId && (a.comment || '') === (b.comment || '');
}

function lightenColor(hex, ratio = 0.3) {
  const safe = /^#([0-9a-f]{6})$/i.test(hex) ? hex : '#cbd5e1';
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(safe.slice(offset, offset + 2), 16));
  const mix = (value) => Math.round(value + (255 - value) * ratio);
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}
