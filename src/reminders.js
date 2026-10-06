// Measurement reminders, following home blood pressure monitoring guidelines (ESH 2023, AHA):
// measure twice a day, in the morning before medication and breakfast and in the evening before
// dinner, taking two readings one minute apart each time. Before a doctor's visit this is done for
// seven consecutive days.
//
// Shared by the page and the service worker, so it must not touch the DOM or localStorage. Both
// sides exchange state through the Cache API: the page owns the config, whoever shows a reminder
// records it in "notified" so it is not shown twice.

const CACHE = 'heartpass-reminders';
const CONFIG_KEY = 'config';
const NOTIFIED_KEY = 'notified';

export const SYNC_TAG = 'bp-reminder';
export const SLOTS = ['morning', 'evening'];
export const SERIES_DAYS = 7;

// A reminder is still useful this long after its time, e.g. when the app is opened a bit later.
const LATE_MS = 3 * 60 * 60 * 1000;
// A measurement taken shortly before the reminder time already counts for that slot.
const EARLY_MS = 60 * 60 * 1000;

export const DEFAULT_CONFIG = {
  enabled: false,
  // 'daily' or 'series' (seven days from seriesStart, before a doctor's visit).
  mode: 'daily',
  morning: '07:00',
  evening: '18:00',
  seriesStart: null,
  // Date (ISO) of the most recent measurement, kept up to date by the page.
  latest: null,
  // Localized notification texts per slot, as the service worker has no access to the UI language.
  texts: {},
};

async function readJson(key) {
  try {
    const res = await (await caches.open(CACHE)).match(key);
    return res ? await res.json() : null;
  } catch {
    return null;
  }
}

async function writeJson(key, value) {
  const cache = await caches.open(CACHE);
  await cache.put(key, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
}

export async function loadConfig() {
  return { ...DEFAULT_CONFIG, ...(await readJson(CONFIG_KEY)) };
}

export const saveConfig = (config) => writeJson(CONFIG_KEY, config);

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const parseLocalDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** First and last day of the measurement series, or null outside series mode. */
export function seriesRange(config) {
  if (config.mode !== 'series' || !config.seriesStart) return null;
  const start = parseLocalDate(config.seriesStart);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + SERIES_DAYS - 1);
  return { start, end };
}

function slotTime(config, slot, day) {
  const [h, m] = config[slot].split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

function isActiveDay(config, day) {
  const range = seriesRange(config);
  return !range || (day >= range.start && day <= range.end);
}

/** The reminder that should be shown now, or null. */
export async function dueReminder(now = new Date()) {
  const config = await loadConfig();
  if (!config.enabled) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!isActiveDay(config, today)) return null;
  const notified = await readJson(NOTIFIED_KEY);
  for (const slot of SLOTS) {
    const at = slotTime(config, slot, today);
    const key = `${localDate(today)}-${slot}`;
    if (now < at || now - at > LATE_MS || notified === key) continue;
    if (config.latest && new Date(config.latest) >= at - EARLY_MS) continue;
    return { key, slot, ...config.texts[slot] };
  }
  return null;
}

/** Shows the due reminder, if any, through the service worker registration. */
export async function checkReminders(registration) {
  const due = await dueReminder();
  if (!due) return;
  // Record first, so the page and the service worker don't both show it.
  await writeJson(NOTIFIED_KEY, due.key);
  await registration.showNotification(due.title, {
    body: due.body,
    tag: SYNC_TAG,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
  });
}
