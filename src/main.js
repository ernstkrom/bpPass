import 'beercss';
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import {
  isSupported,
  listMeasurements,
  saveMeasurement,
  createMeasurement,
  importMeasurements,
} from './storage.js';
import { parseMedilogCsv } from './medilog.js';

registerSW({ immediate: true });

const $ = (sel) => document.querySelector(sel);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

let snackTimer;
function toast(message, isError = false) {
  const bar = $('#snackbar');
  bar.textContent = message;
  bar.classList.toggle('error', isError);
  bar.classList.add('active');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => bar.classList.remove('active'), 3000);
}

// --- Tabs ---------------------------------------------------------------

function showPage(name) {
  if (!document.getElementById(name)?.classList.contains('page')) name = 'home';
  document.querySelectorAll('main > .page').forEach((p) => p.classList.toggle('active', p.id === name));
  document.querySelectorAll('nav.bottom a').forEach((a) => a.classList.toggle('active', a.dataset.page === name));
  $('#add-btn').hidden = name !== 'home';
}

window.addEventListener('hashchange', () => showPage(location.hash.slice(1)));
showPage(location.hash.slice(1));

// --- Home ---------------------------------------------------------------

const avg = (list, key) => list.reduce((sum, m) => sum + m[key], 0) / list.length;

let measurements = [];

function measurementRow(m, format) {
  const tr = document.createElement('tr');
  for (const [value, cls] of [
    [format.format(new Date(m.date)), ''],
    [m.systolic, 'right-align'],
    [m.diastolic, 'right-align'],
    [m.pulse, 'right-align'],
  ]) {
    const td = document.createElement('td');
    td.textContent = value;
    if (cls) td.className = cls;
    tr.append(td);
  }
  return tr;
}

// Start of each averaging period, relative to now.
const PERIODS = {
  '7d': (d) => d.setDate(d.getDate() - 7),
  '14d': (d) => d.setDate(d.getDate() - 14),
  '1m': (d) => d.setMonth(d.getMonth() - 1),
  '3m': (d) => d.setMonth(d.getMonth() - 3),
  '6m': (d) => d.setMonth(d.getMonth() - 6),
  '1y': (d) => d.setFullYear(d.getFullYear() - 1),
  all: () => -Infinity,
};

const periodSelect = $('#avg-period');
try {
  const saved = localStorage.getItem('avgPeriod');
  if (saved in PERIODS) periodSelect.value = saved;
} catch {
  // Ignore unavailable storage.
}
periodSelect.addEventListener('change', () => {
  try {
    localStorage.setItem('avgPeriod', periodSelect.value);
  } catch {
    // Remembering the period is only a convenience.
  }
  renderAverages();
});

function renderAverages() {
  const since = PERIODS[periodSelect.value](new Date());
  const list = measurements.filter((m) => new Date(m.date).getTime() >= since);
  $('#avg-info').textContent = `Averages of ${list.length} measurement(s)`;

  if (list.length) {
    const sys = avg(list, 'systolic');
    const dia = avg(list, 'diastolic');
    // Mean arterial pressure ≈ DBP + (SBP − DBP) / 3
    const map = dia + (sys - dia) / 3;
    $('#avg-sys').textContent = Math.round(sys);
    $('#avg-dia').textContent = Math.round(dia);
    $('#avg-map').textContent = Math.round(map);
  } else {
    $('#avg-sys').textContent = $('#avg-dia').textContent = $('#avg-map').textContent = '–';
  }
}

async function render() {
  const list = (measurements = await listMeasurements());
  $('#measurements').replaceChildren(...list.map((m) => measurementRow(m, dateFormat)));
  $('#empty').hidden = list.length > 0;
  renderCalendar();
  $('#storage-info').textContent = `${list.length} measurement(s) stored in the origin private file system.`;
  renderAverages();
  return list;
}

// --- Calendar -----------------------------------------------------------

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
const MAX_PER_CELL = 3;

// 0 = Sunday … 6 = Saturday; Intl weekInfo uses 1 = Monday … 7 = Sunday.
const firstWeekday = (() => {
  try {
    const locale = new Intl.Locale(navigator.language);
    const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay;
    return firstDay ? firstDay % 7 : 1;
  } catch {
    return 1;
  }
})();

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const today = new Date();
let calMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

// Readings at or above stage 1 hypertension (ACC/AHA: ≥130 / ≥80 mmHg).
const isHigh = (m) => m.systolic >= 130 || m.diastolic >= 80;

function renderCalendar() {
  const byDay = new Map();
  // Oldest first within a day.
  for (const m of [...measurements].reverse()) {
    const key = dayKey(new Date(m.date));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(m);
  }

  $('#cal-title').textContent = monthFormat.format(calMonth);
  const cells = [];
  for (let i = 0; i < 7; i++) {
    // 2023-01-01 was a Sunday.
    const div = document.createElement('div');
    div.className = 'weekday';
    div.textContent = weekdayFormat.format(new Date(2023, 0, 1 + ((firstWeekday + i) % 7)));
    cells.push(div);
  }

  const offset = (calMonth.getDay() - firstWeekday + 7) % 7;
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  for (let i = 0; i < offset; i++) cells.push(document.createElement('div'));
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
    const entries = byDay.get(dayKey(date)) ?? [];
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day';
    cell.classList.toggle('today', dayKey(date) === dayKey(today));
    cell.classList.toggle('selected', dayKey(date) === dayKey(selectedDay));
    cell.setAttribute('aria-label', `${dayFormat.format(date)}, ${entries.length} measurement(s)`);
    cell.addEventListener('click', () => {
      selectedDay = date;
      renderCalendar();
    });

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = day;
    cell.append(num);
    for (const m of entries.slice(0, MAX_PER_CELL)) {
      const chip = document.createElement('span');
      chip.className = 'reading' + (isHigh(m) ? ' high' : '');
      chip.textContent = `${m.systolic}/${m.diastolic}`;
      cell.append(chip);
    }
    if (entries.length > MAX_PER_CELL) {
      const more = document.createElement('span');
      more.className = 'more';
      more.textContent = `+${entries.length - MAX_PER_CELL}`;
      cell.append(more);
    }
    cells.push(cell);
  }
  $('#calendar').replaceChildren(...cells);

  const dayEntries = byDay.get(dayKey(selectedDay)) ?? [];
  $('#day-title').textContent = dayFormat.format(selectedDay);
  $('#day-measurements').replaceChildren(...dayEntries.map((m) => measurementRow(m, timeFormat)));
  $('#day-empty').hidden = dayEntries.length > 0;
}

function shiftMonth(delta) {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + delta, 1);
  renderCalendar();
}
$('#cal-prev').addEventListener('click', () => shiftMonth(-1));
$('#cal-next').addEventListener('click', () => shiftMonth(1));

function showView(view) {
  $('#list-view').hidden = view !== 'list';
  $('#calendar-view').hidden = view !== 'calendar';
  for (const btn of document.querySelectorAll('[data-view]')) btn.classList.toggle('active', btn.dataset.view === view);
  try {
    localStorage.setItem('view', view);
  } catch {
    // Remembering the view is only a convenience.
  }
}
for (const btn of document.querySelectorAll('[data-view]')) {
  btn.addEventListener('click', () => showView(btn.dataset.view));
}
try {
  if (localStorage.getItem('view') === 'calendar') showView('calendar');
} catch {
  // Ignore unavailable storage.
}

const dialog = $('#add-dialog');
const form = $('#add-form');

$('#add-btn').addEventListener('click', () => {
  form.reset();
  dialog.showModal();
});
$('#cancel-btn').addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const systolic = Number(data.get('systolic'));
  const diastolic = Number(data.get('diastolic'));
  const pulse = Number(data.get('pulse'));
  if (diastolic >= systolic) {
    toast('Diastolic must be lower than systolic', true);
    return;
  }
  try {
    await saveMeasurement(createMeasurement({ systolic, diastolic, pulse }));
    dialog.close();
    await render();
    toast('Measurement saved');
  } catch (err) {
    toast(`Could not save: ${err.message}`, true);
  }
});

// --- Settings -----------------------------------------------------------

const colorblindToggle = $('#colorblind');
function setColorblind(on) {
  document.body.classList.toggle('colorblind', on);
  colorblindToggle.checked = on;
}
try {
  setColorblind(localStorage.getItem('colorblind') === 'true');
} catch {
  // Ignore unavailable storage.
}
colorblindToggle.addEventListener('change', () => {
  setColorblind(colorblindToggle.checked);
  try {
    localStorage.setItem('colorblind', colorblindToggle.checked);
  } catch {
    // Remembering the setting is only a convenience.
  }
});

$('#export-btn').addEventListener('click', async () => {
  const list = await listMeasurements();
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `HeartPass-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${list.length} measurement(s)`);
});

const fileInput = $('#import-file');
$('#import-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const { imported, skipped } = await importMeasurements(JSON.parse(await file.text()));
    await render();
    toast(`Imported ${imported} measurement(s)` + (skipped ? `, skipped ${skipped} invalid` : ''));
  } catch (err) {
    toast(`Import failed: ${err.message}`, true);
  }
});

const medilogInput = $('#medilog-file');
$('#medilog-btn').addEventListener('click', () => medilogInput.click());
medilogInput.addEventListener('change', async () => {
  const file = medilogInput.files[0];
  medilogInput.value = '';
  if (!file) return;
  try {
    const { measurements, ignored } = parseMedilogCsv(await file.text());
    const { imported, skipped } = await importMeasurements(measurements);
    await render();
    const notes = [skipped && `skipped ${skipped} invalid`, ignored && `ignored ${ignored} non-blood-pressure`];
    toast([`Imported ${imported} measurement(s)`, ...notes.filter(Boolean)].join(', '));
  } catch (err) {
    toast(`MediLog import failed: ${err.message}`, true);
  }
});

// --- Startup ------------------------------------------------------------

if (!isSupported()) {
  toast('This browser does not support the Origin Private File System', true);
} else {
  // Ask the browser not to evict our data under storage pressure.
  navigator.storage.persist?.();
  render().catch((err) => toast(`Could not load data: ${err.message}`, true));
}
