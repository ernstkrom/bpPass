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

async function render() {
  const list = await listMeasurements();
  const tbody = $('#measurements');
  tbody.replaceChildren(
    ...list.map((m) => {
      const tr = document.createElement('tr');
      for (const [value, cls] of [
        [dateFormat.format(new Date(m.date)), ''],
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
    }),
  );
  $('#empty').hidden = list.length > 0;
  $('#storage-info').textContent = `${list.length} measurement(s) stored in the origin private file system.`;

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
  return list;
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

$('#export-btn').addEventListener('click', async () => {
  const list = await listMeasurements();
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bppass-${new Date().toISOString().slice(0, 10)}.json`;
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
