// UI translations. Values are strings or functions of the params passed to t().
// Static markup is translated through data-i18n (text), data-i18n-html (trusted markup)
// and data-i18n-aria (aria-label) attributes.

const plural = (n, one, other) => (n === 1 ? one : other).replace('{n}', n);

const MESSAGES = {
  en: {
    'nav.home': 'Home',
    'nav.settings': 'Settings',
    'period.label': 'Averaging period',
    'period.7d': 'Last 7 days',
    'period.14d': 'Last 14 days',
    'period.1m': 'Last month',
    'period.3m': 'Last 3 months',
    'period.6m': 'Last 6 months',
    'period.1y': 'Last year',
    'period.all': 'All time',
    'avg.info': ({ n }) => plural(n, 'Average of {n} measurement', 'Averages of {n} measurements'),
    'avg.sys': 'Avg. systolic',
    'avg.dia': 'Avg. diastolic',
    'avg.map': 'MAP',
    'view.list': 'List',
    'view.calendar': 'Calendar',
    'col.date': 'Date',
    'col.time': 'Time',
    'col.sys': 'SYS',
    'col.dia': 'DIA',
    'col.pulse': 'Pulse',
    'list.empty': 'No measurements yet. Tap <b>+</b> to add one.',
    'cal.prev': 'Previous month',
    'cal.next': 'Next month',
    'cal.dayEmpty': 'No measurements on this day.',
    'cal.dayLabel': ({ date, n }) => `${date}, ${plural(n, '{n} measurement', '{n} measurements')}`,
    'settings.display': 'Display',
    'settings.language': 'Language',
    'settings.languageDesc': 'Language of the app.',
    'settings.languageAuto': 'Automatic (system)',
    'settings.colorblind': 'Colorblind mode',
    'settings.colorblindDesc': 'Highlight elevated readings with a high-contrast marker instead of red text.',
    'settings.guide': 'Measurement instructions',
    'settings.guideDesc': 'Show how to measure correctly each time you add a new measurement.',
    'settings.data': 'Data',
    'settings.export': 'Export',
    'settings.exportDesc': 'Download all measurements as a JSON file.',
    'settings.import': 'Import',
    'settings.importDesc': 'Load measurements from a JSON file. Entries with the same id are replaced.',
    'settings.medilog': 'Import from MediLog',
    'settings.medilogDesc':
      'Load blood pressure readings from a MediLog (Android) backup. Select the <b>MediLog-Data.csv</b> file; other data types are ignored and re-importing the same file creates no duplicates.',
    'settings.medilogBtn': 'Import CSV',
    'settings.storageInfo': ({ n }) =>
      plural(n, '{n} measurement', '{n} measurements') + ' stored in the origin private file system.',
    'add.label': 'Add measurement',
    'guide.title': 'Before you measure',
    'guide.preparation': 'Preparation',
    'guide.noSmoking': 'No smoking, coffee, food or exercise for 30 minutes beforehand',
    'guide.quiet': 'Quiet surroundings',
    'guide.temperature': 'Comfortable room temperature',
    'guide.rest': 'Rest for 5 minutes before measuring',
    'guide.noTalking': "Don't talk during or between measurements",
    'guide.position': 'Position',
    'guide.sit': 'Sit with your back supported and both feet flat on the floor',
    'guide.arm': 'Bare arm resting on a table, the middle of the upper arm at heart level',
    'guide.cuff': 'Use a cuff that fits your arm circumference (small, normal or large)',
    'guide.device': 'Use a validated electronic upper-arm monitor',
    'guide.hide': "Don't show this again",
    'action.cancel': 'Cancel',
    'action.continue': 'Continue',
    'action.save': 'Save',
    'form.title': 'New measurement',
    'form.sys': 'Systolic (mmHg)',
    'form.dia': 'Diastolic (mmHg)',
    'form.pulse': 'Pulse (bpm)',
    'toast.diaHigher': 'Diastolic must be lower than systolic',
    'toast.saved': 'Measurement saved',
    'toast.saveFailed': ({ error }) => `Could not save: ${error}`,
    'toast.exported': ({ n }) => plural(n, 'Exported {n} measurement', 'Exported {n} measurements'),
    'toast.imported': ({ n }) => plural(n, 'Imported {n} measurement', 'Imported {n} measurements'),
    'toast.skipped': ({ n }) => `skipped ${n} invalid`,
    'toast.ignored': ({ n }) => `ignored ${n} non-blood-pressure`,
    'toast.importFailed': ({ error }) => `Import failed: ${error}`,
    'toast.medilogFailed': ({ error }) => `MediLog import failed: ${error}`,
    'toast.unsupported': 'This browser does not support the Origin Private File System',
    'toast.loadFailed': ({ error }) => `Could not load data: ${error}`,
    'error.notMedilog': 'Not a MediLog data export (expected MediLog-Data.csv)',
    'error.notArray': 'Expected a JSON array of measurements',
    'error.invalid': 'Invalid measurement',
  },
  de: {
    'nav.home': 'Start',
    'nav.settings': 'Einstellungen',
    'period.label': 'Zeitraum für Durchschnitt',
    'period.7d': 'Letzte 7 Tage',
    'period.14d': 'Letzte 14 Tage',
    'period.1m': 'Letzter Monat',
    'period.3m': 'Letzte 3 Monate',
    'period.6m': 'Letzte 6 Monate',
    'period.1y': 'Letztes Jahr',
    'period.all': 'Gesamter Zeitraum',
    'avg.info': ({ n }) => plural(n, 'Durchschnitt aus {n} Messung', 'Durchschnitt aus {n} Messungen'),
    'avg.sys': 'Ø Systolisch',
    'avg.dia': 'Ø Diastolisch',
    'avg.map': 'MAD',
    'view.list': 'Liste',
    'view.calendar': 'Kalender',
    'col.date': 'Datum',
    'col.time': 'Uhrzeit',
    'col.sys': 'SYS',
    'col.dia': 'DIA',
    'col.pulse': 'Puls',
    'list.empty': 'Noch keine Messungen. Tippen Sie auf <b>+</b>, um eine hinzuzufügen.',
    'cal.prev': 'Vorheriger Monat',
    'cal.next': 'Nächster Monat',
    'cal.dayEmpty': 'Keine Messungen an diesem Tag.',
    'cal.dayLabel': ({ date, n }) => `${date}, ${plural(n, '{n} Messung', '{n} Messungen')}`,
    'settings.display': 'Anzeige',
    'settings.language': 'Sprache',
    'settings.languageDesc': 'Sprache der App.',
    'settings.languageAuto': 'Automatisch (System)',
    'settings.colorblind': 'Farbenblind-Modus',
    'settings.colorblindDesc': 'Erhöhte Werte mit einer kontrastreichen Markierung statt roter Schrift hervorheben.',
    'settings.guide': 'Messanleitung',
    'settings.guideDesc': 'Bei jeder neuen Messung anzeigen, wie richtig gemessen wird.',
    'settings.data': 'Daten',
    'settings.export': 'Exportieren',
    'settings.exportDesc': 'Alle Messungen als JSON-Datei herunterladen.',
    'settings.import': 'Importieren',
    'settings.importDesc': 'Messungen aus einer JSON-Datei laden. Einträge mit derselben ID werden ersetzt.',
    'settings.medilog': 'Aus MediLog importieren',
    'settings.medilogDesc':
      'Blutdruckwerte aus einer Sicherung von MediLog (Android) laden. Wählen Sie die Datei <b>MediLog-Data.csv</b>; andere Datentypen werden ignoriert und ein erneuter Import derselben Datei erzeugt keine Duplikate.',
    'settings.medilogBtn': 'CSV importieren',
    'settings.storageInfo': ({ n }) =>
      plural(n, '{n} Messung', '{n} Messungen') + ' im Origin Private File System gespeichert.',
    'add.label': 'Messung hinzufügen',
    'guide.title': 'Vor der Messung',
    'guide.preparation': 'Vorbereitung',
    'guide.noSmoking': '30 Minuten vorher nicht rauchen, keinen Kaffee trinken, nichts essen und keinen Sport treiben',
    'guide.quiet': 'Ruhige Umgebung',
    'guide.temperature': 'Angenehme Raumtemperatur',
    'guide.rest': 'Vor der Messung 5 Minuten ruhen',
    'guide.noTalking': 'Während und zwischen den Messungen nicht sprechen',
    'guide.position': 'Körperhaltung',
    'guide.sit': 'Mit angelehntem Rücken sitzen, beide Füße flach auf dem Boden',
    'guide.arm': 'Unbekleideter Arm liegt auf dem Tisch, die Mitte des Oberarms auf Herzhöhe',
    'guide.cuff': 'Eine Manschette verwenden, die zum Armumfang passt (klein, normal oder groß)',
    'guide.device': 'Ein validiertes elektronisches Oberarm-Messgerät verwenden',
    'guide.hide': 'Nicht mehr anzeigen',
    'action.cancel': 'Abbrechen',
    'action.continue': 'Weiter',
    'action.save': 'Speichern',
    'form.title': 'Neue Messung',
    'form.sys': 'Systolisch (mmHg)',
    'form.dia': 'Diastolisch (mmHg)',
    'form.pulse': 'Puls (Schläge/min)',
    'toast.diaHigher': 'Der diastolische Wert muss niedriger als der systolische sein',
    'toast.saved': 'Messung gespeichert',
    'toast.saveFailed': ({ error }) => `Speichern fehlgeschlagen: ${error}`,
    'toast.exported': ({ n }) => plural(n, '{n} Messung exportiert', '{n} Messungen exportiert'),
    'toast.imported': ({ n }) => plural(n, '{n} Messung importiert', '{n} Messungen importiert'),
    'toast.skipped': ({ n }) => `${n} ungültige übersprungen`,
    'toast.ignored': ({ n }) => plural(n, '{n} Nicht-Blutdruck-Eintrag ignoriert', '{n} Nicht-Blutdruck-Einträge ignoriert'),
    'toast.importFailed': ({ error }) => `Import fehlgeschlagen: ${error}`,
    'toast.medilogFailed': ({ error }) => `MediLog-Import fehlgeschlagen: ${error}`,
    'toast.unsupported': 'Dieser Browser unterstützt das Origin Private File System nicht',
    'toast.loadFailed': ({ error }) => `Daten konnten nicht geladen werden: ${error}`,
    'error.notMedilog': 'Kein MediLog-Datenexport (MediLog-Data.csv erwartet)',
    'error.notArray': 'JSON-Array mit Messungen erwartet',
    'error.invalid': 'Ungültige Messung',
  },
};

export const LANGUAGES = Object.keys(MESSAGES);

function systemLanguage() {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const lang = tag?.split('-')[0];
    if (lang in MESSAGES) return lang;
  }
  return 'en';
}

let preference = 'auto';
try {
  const saved = localStorage.getItem('lang');
  if (saved in MESSAGES) preference = saved;
} catch {
  // Ignore unavailable storage.
}

let lang = preference === 'auto' ? systemLanguage() : preference;

export const getLanguagePreference = () => preference;

export function setLanguagePreference(value) {
  preference = value in MESSAGES ? value : 'auto';
  lang = preference === 'auto' ? systemLanguage() : preference;
  try {
    localStorage.setItem('lang', preference);
  } catch {
    // Remembering the language is only a convenience.
  }
  translatePage();
}

/** Locale for Intl formatters: keeps the user's region (e.g. de-AT) when it matches the UI language. */
export function locale() {
  const system = navigator.language;
  return system?.split('-')[0] === lang ? system : lang;
}

export function t(key, params = {}) {
  const msg = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  return typeof msg === 'function' ? msg(params) : msg;
}

export function translatePage(root = document) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
