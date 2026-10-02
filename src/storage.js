// Measurements live in the Origin Private File System (OPFS):
// one JSON file per measurement inside the "measurements" directory.

const DIR_NAME = 'measurements';

async function getDir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR_NAME, { create: true });
}

async function writeFile(dir, name, text) {
  const handle = await dir.getFileHandle(name, { create: true });
  if ('createWritable' in handle) {
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  } else {
    // Older Safari only supports synchronous access handles, which require a worker.
    await writeInWorker(name, text);
  }
}

function writeInWorker(name, text) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./opfs-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      data.ok ? resolve() : reject(new Error(data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e);
    };
    worker.postMessage({ dir: DIR_NAME, name, text });
  });
}

function isValid(m) {
  return (
    m &&
    typeof m.id === 'string' &&
    !Number.isNaN(Date.parse(m.date)) &&
    [m.systolic, m.diastolic, m.pulse].every((v) => Number.isFinite(v) && v > 0)
  );
}

export function isSupported() {
  return !!navigator.storage?.getDirectory;
}

export async function listMeasurements() {
  const dir = await getDir();
  const items = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
    try {
      const m = JSON.parse(await (await handle.getFile()).text());
      if (isValid(m)) items.push(m);
    } catch {
      // Skip unreadable/corrupt files.
    }
  }
  return items.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function saveMeasurement(m) {
  if (!isValid(m)) throw new Error('Invalid measurement');
  const dir = await getDir();
  await writeFile(dir, `${m.id}.json`, JSON.stringify(m));
}

export function createMeasurement({ systolic, diastolic, pulse, date = new Date() }) {
  return {
    id: crypto.randomUUID(),
    date: new Date(date).toISOString(),
    systolic,
    diastolic,
    pulse,
  };
}

/** Imports an array of measurements, overwriting entries with the same id. Returns { imported, skipped }. */
export async function importMeasurements(list) {
  if (!Array.isArray(list)) throw new Error('Expected a JSON array of measurements');
  let imported = 0;
  let skipped = 0;
  for (const raw of list) {
    const m = {
      id: typeof raw?.id === 'string' && /^[\w-]+$/.test(raw.id) ? raw.id : crypto.randomUUID(),
      date: raw?.date,
      systolic: Number(raw?.systolic),
      diastolic: Number(raw?.diastolic),
      pulse: Number(raw?.pulse),
    };
    if (isValid(m)) {
      m.date = new Date(m.date).toISOString();
      await saveMeasurement(m);
      imported++;
    } else {
      skipped++;
    }
  }
  return { imported, skipped };
}
