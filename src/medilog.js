// Adapter for CSV exports of the MediLog Android app (MediLog-Data.csv).
//
// Columns: timestamp,comment,type,value1,value2,value3,value4,attachment,profile_id,category_id,tags
// Rows with type 2 are blood pressure: value1 = systolic, value2 = diastolic, value3 = pulse.
// Timestamps are local time without a zone ("2026-07-20 20:46:10").

import { t } from './i18n.js';

const BLOOD_PRESSURE_TYPE = '2';

/** Minimal RFC 4180 parser: quoted fields, escaped quotes ("") and embedded newlines. */
function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

// MediLog lets the user configure the delimiter, so detect it from the header line.
function detectDelimiter(headerLine) {
  return [',', ';', '\t', '|'].find((d) => headerLine.split(d).includes('timestamp')) ?? ',';
}

function parseLocalTimestamp(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '0'] = m;
  return new Date(+y, mo - 1, +d, +h, +mi, +s);
}

export function isMedilogCsv(text) {
  const header = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0];
  const cols = header.split(detectDelimiter(header));
  return ['timestamp', 'type', 'value1', 'value2', 'value3'].every((c) => cols.includes(c));
}

/**
 * Converts a MediLog CSV export into measurement objects.
 * Returns { measurements, ignored } where ignored counts non-blood-pressure rows.
 */
export function parseMedilogCsv(text) {
  text = text.replace(/^﻿/, '');
  if (!isMedilogCsv(text)) throw new Error(t('error.notMedilog'));

  const [header, ...rows] = parseCsv(text, detectDelimiter(text.split(/\r?\n/, 1)[0]));
  const col = Object.fromEntries(header.map((name, i) => [name.trim(), i]));

  const measurements = [];
  let ignored = 0;
  for (const row of rows) {
    if (row[col.type]?.trim() !== BLOOD_PRESSURE_TYPE) {
      ignored++;
      continue;
    }
    const date = parseLocalTimestamp(row[col.timestamp] ?? '');
    const systolic = Number(row[col.value1]);
    const diastolic = Number(row[col.value2]);
    const pulse = Number(row[col.value3]);
    measurements.push({
      // Deterministic id so importing the same export twice doesn't create duplicates.
      id: date ? `medilog-${date.getTime()}-${systolic}-${diastolic}-${pulse}` : undefined,
      date: date?.toISOString(),
      systolic,
      diastolic,
      pulse,
    });
  }
  return { measurements, ignored };
}
