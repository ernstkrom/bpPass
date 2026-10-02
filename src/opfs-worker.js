// Fallback writer for browsers without FileSystemFileHandle.createWritable (older Safari).
self.onmessage = async ({ data: { dir, name, text } }) => {
  let access;
  try {
    const root = await navigator.storage.getDirectory();
    const folder = await root.getDirectoryHandle(dir, { create: true });
    const handle = await folder.getFileHandle(name, { create: true });
    access = await handle.createSyncAccessHandle();
    const bytes = new TextEncoder().encode(text);
    access.truncate(0);
    access.write(bytes, { at: 0 });
    access.flush();
    self.postMessage({ ok: true });
  } catch (e) {
    self.postMessage({ ok: false, error: String(e) });
  } finally {
    access?.close();
  }
};
