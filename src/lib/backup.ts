import { getPhoto, newClaim, putPhoto, type Claim } from './claim';

/** One file holding the whole claim and its photos, so it survives a lost or wiped phone. */
interface BackupFile {
  app: 'aidready';
  version: 1;
  savedAt: number;
  claim: Claim;
  photos: Record<string, string>; // photo id -> base64 JPEG
}

async function toBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function makeBackup(c: Claim): Promise<Blob> {
  const photos: Record<string, string> = {};
  const ids = [...c.photos.map((p) => p.id), ...c.expenses.flatMap((e) => (e.receipt ? [e.receipt] : []))];
  for (const id of ids) {
    const b = await getPhoto(id);
    if (b) photos[id] = await toBase64(b);
  }
  const file: BackupFile = { app: 'aidready', version: 1, savedAt: Date.now(), claim: c, photos };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/** Checks a backup file's shape before anything is overwritten. Throws a readable error if it isn't one. */
export function parseBackup(text: string): BackupFile {
  let f: Partial<BackupFile>;
  try {
    f = JSON.parse(text);
  } catch {
    throw new Error("This file isn't an AidReady backup.");
  }
  const c = f?.claim as Partial<Claim> | undefined;
  if (f?.app !== 'aidready' || f.version !== 1 || !c || typeof f.photos !== 'object' || f.photos === null) throw new Error("This file isn't an AidReady backup.");
  if (!isArr(c.rooms) || !isArr(c.items) || !isArr(c.photos)) throw new Error('This backup is damaged.');
  if (!c.rooms.every((r) => isStr(r?.id) && isStr(r?.name))) throw new Error('This backup is damaged.');
  if (!c.items.every((i) => isStr(i?.id) && isStr(i?.roomId) && isStr(i?.name) && (i.estimate === null || typeof i.estimate === 'number'))) throw new Error('This backup is damaged.');
  if (!c.photos.every((p) => isStr(p?.id) && isStr(p?.roomId))) throw new Error('This backup is damaged.');
  if (!Object.values(f.photos).every((v) => isStr(v) && /^[A-Za-z0-9+/=]*$/.test(v))) throw new Error('This backup is damaged.');
  return { ...(f as BackupFile), claim: { ...newClaim(), ...(c as Claim), details: { ...newClaim().details, ...c.details } } };
}

/** Writes the backup's photos into this device's store and returns the claim to load. */
export async function restoreBackup(file: File): Promise<Claim> {
  const b = parseBackup(await file.text());
  for (const [id, data] of Object.entries(b.photos)) {
    const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
    await putPhoto(id, new Blob([bytes], { type: 'image/jpeg' }));
  }
  return b.claim;
}
