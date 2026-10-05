import 'beercss';
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import {
  isSupported,
  listMeasurements,
  saveMeasurement,
  deleteMeasurement,
  createMeasurement,
  importMeasurements,
} from './storage.js';
import { parseMedilogCsv } from './medilog.js';
import { t, translatePage, locale, getLanguagePreference, setLanguagePreference } from './i18n.js';

registerSW({ immediate: true });
translatePage();

const $ = (sel) => document.querySelector(sel);

// --- Native app feel ----------------------------------------------------

// Suppress the browser's long-press / right-click menu and dragging of links and icons,
// except in text fields where copy & paste should keep working.
const isEditable = (el) => el instanceof Element && el.closest('input, textarea, select, [contenteditable]');
document.addEventListener('contextmenu', (e) => {
  if (!isEditable(e.target)) e.preventDefault();
});
document.addEventListener('dragstart', (e) => {
  if (!isEditable(e.target)) e.preventDefault();
});

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
  tr.className = 'editable';
  tr.tabIndex = 0;
  tr.setAttribute('aria-label', t('edit.label', { date: dateFormat.format(new Date(m.date)) }));
  tr.addEventListener('click', () => openEditDialog(m));
  tr.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openEditDialog(m);
    }
  });
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
  $('#avg-info').textContent = t('avg.info', { n: list.length });

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

function draw() {
  $('#measurements').replaceChildren(...measurements.map((m) => measurementRow(m, dateFormat)));
  $('#empty').hidden = measurements.length > 0;
  renderCalendar();
  $('#storage-info').textContent = t('settings.storageInfo', { n: measurements.length });
  renderAverages();
}

async function render() {
  measurements = await listMeasurements();
  draw();
  return measurements;
}

// --- Calendar -----------------------------------------------------------

let dateFormat, monthFormat, dayFormat, timeFormat, weekdayFormat;
function createFormats() {
  const loc = locale();
  dateFormat = new Intl.DateTimeFormat(loc, { dateStyle: 'medium', timeStyle: 'short' });
  monthFormat = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' });
  dayFormat = new Intl.DateTimeFormat(loc, { dateStyle: 'full' });
  timeFormat = new Intl.DateTimeFormat(loc, { timeStyle: 'short' });
  weekdayFormat = new Intl.DateTimeFormat(loc, { weekday: 'narrow' });
}
createFormats();
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
    cell.setAttribute('aria-label', t('cal.dayLabel', { date: dayFormat.format(date), n: entries.length }));
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

const guideDialog = $('#guide-dialog');
const guideHide = $('#guide-hide');
const showGuideToggle = $('#show-guide');

function setShowGuide(on) {
  showGuideToggle.checked = on;
  try {
    localStorage.setItem('showGuide', on);
  } catch {
    // Remembering the setting is only a convenience.
  }
}
try {
  showGuideToggle.checked = localStorage.getItem('showGuide') !== 'false';
} catch {
  showGuideToggle.checked = true;
}
showGuideToggle.addEventListener('change', () => setShowGuide(showGuideToggle.checked));

const dateInput = $('#date');

// Measurement being edited, or null when adding a new one.
let editing = null;

// Value for a datetime-local input, which expects local time without a zone.
function toLocalInput(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function openAddDialog() {
  editing = null;
  form.reset();
  $('#form-title').textContent = t('form.title');
  dateInput.parentElement.hidden = true;
  dateInput.disabled = true;
  $('#delete-btn').hidden = true;
  dialog.showModal();
}

function openEditDialog(m) {
  editing = m;
  form.reset();
  $('#form-title').textContent = t('form.editTitle');
  form.elements.systolic.value = m.systolic;
  form.elements.diastolic.value = m.diastolic;
  form.elements.pulse.value = m.pulse;
  dateInput.disabled = false;
  dateInput.parentElement.hidden = false;
  dateInput.value = toLocalInput(m.date);
  dateInput.max = toLocalInput(new Date());
  $('#delete-btn').hidden = false;
  dialog.showModal();
}

$('#add-btn').addEventListener('click', () => {
  if (showGuideToggle.checked) {
    guideHide.checked = false;
    guideDialog.showModal();
  } else {
    openAddDialog();
  }
});
$('#guide-cancel').addEventListener('click', () => guideDialog.close());
$('#guide-continue').addEventListener('click', () => {
  if (guideHide.checked) setShowGuide(false);
  guideDialog.close();
  openAddDialog();
});
$('#cancel-btn').addEventListener('click', () => dialog.close());

const deleteDialog = $('#delete-dialog');
$('#delete-btn').addEventListener('click', () => {
  $('#delete-info').textContent = t('delete.info', {
    date: dateFormat.format(new Date(editing.date)),
    value: `${editing.systolic}/${editing.diastolic}`,
  });
  deleteDialog.showModal();
});
$('#delete-cancel').addEventListener('click', () => deleteDialog.close());
$('#delete-confirm').addEventListener('click', async () => {
  try {
    await deleteMeasurement(editing.id);
    deleteDialog.close();
    dialog.close();
    await render();
    toast(t('toast.deleted'));
  } catch (err) {
    deleteDialog.close();
    toast(t('toast.deleteFailed', { error: err.message }), true);
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const systolic = Number(data.get('systolic'));
  const diastolic = Number(data.get('diastolic'));
  const pulse = Number(data.get('pulse'));
  if (diastolic >= systolic) {
    toast(t('toast.diaHigher'), true);
    return;
  }
  try {
    if (editing) {
      // Keep the original timestamp (with seconds) unless the date was actually changed.
      const date =
        dateInput.value === toLocalInput(editing.date) ? editing.date : new Date(dateInput.value).toISOString();
      await saveMeasurement({ ...editing, date, systolic, diastolic, pulse });
    } else {
      await saveMeasurement(createMeasurement({ systolic, diastolic, pulse }));
    }
    dialog.close();
    await render();
    toast(t('toast.saved'));
  } catch (err) {
    toast(t('toast.saveFailed', { error: err.message }), true);
  }
});

// --- Settings -----------------------------------------------------------

const languageSelect = $('#language');
languageSelect.value = getLanguagePreference();
languageSelect.addEventListener('change', () => {
  setLanguagePreference(languageSelect.value);
  createFormats();
  draw();
});

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
  toast(t('toast.exported', { n: list.length }));
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
    const notes = [t('toast.imported', { n: imported }), skipped && t('toast.skipped', { n: skipped })];
    toast(notes.filter(Boolean).join(', '));
  } catch (err) {
    toast(t('toast.importFailed', { error: err.message }), true);
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
    const notes = [
      t('toast.imported', { n: imported }),
      skipped && t('toast.skipped', { n: skipped }),
      ignored && t('toast.ignored', { n: ignored }),
    ];
    toast(notes.filter(Boolean).join(', '));
  } catch (err) {
    toast(t('toast.medilogFailed', { error: err.message }), true);
  }
});

// --- Startup ------------------------------------------------------------

const SPLASH_MIN_MS = 1000;

function hideSplash() {
  const splash = $('#splash');
  // Not shown outside the installed app, so there is nothing to wait for.
  if (getComputedStyle(splash).display === 'none') return splash.remove();
  // Keep it up for at least SPLASH_MIN_MS since the page started loading, so it doesn't just flash.
  setTimeout(() => {
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    splash.classList.add('hide');
  }, Math.max(0, SPLASH_MIN_MS - performance.now()));
}

if (!isSupported()) {
  hideSplash();
  toast(t('toast.unsupported'), true);
} else {
  // Ask the browser not to evict our data under storage pressure.
  navigator.storage.persist?.();
  render()
    .catch((err) => toast(t('toast.loadFailed', { error: err.message }), true))
    .finally(hideSplash);
}
