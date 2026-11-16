/**
 * The claim: rooms, damaged items and photos, kept on this phone so everything works with no signal.
 * Claim data lives in localStorage; photos (too big for it) live in IndexedDB.
 */

export type Where = 'on-device' | 'cloud';

export interface Item {
  id: string;
  roomId: string;
  photoId: string;
  name: string;
  damage: string;
  /** Replacement estimate in whole dollars; null when unknown. */
  estimate: number | null;
  /** Who set the estimate: the AI's suggestion or the person. */
  estimateBy: 'ai' | 'you' | null;
  where: Where;
}

export interface Photo {
  id: string;
  roomId: string;
  takenAt: number;
  /** false = saved but not read yet (no signal and no on-device AI); scanned later. */
  scanned: boolean;
}

export interface Room {
  id: string;
  name: string;
  done: boolean;
}

/** Out-of-pocket costs caused by the disaster (hotel, cleanup supplies…), often reimbursable. */
export interface Expense {
  id: string;
  what: string;
  amount: number | null;
  date: string;
  /** Photo id of the receipt in the photo store, if one was scanned. */
  receipt?: string;
}

export interface Claim {
  id: string;
  createdAt: number;
  rooms: Room[];
  items: Item[];
  photos: Photo[];
  expenses: Expense[];
  /** Ids of checklist steps the person has ticked. */
  checks: string[];
  /** Filled into the cover letter's placeholders; never sent to the AI. */
  details: { name: string; address: string; ref: string; insurer?: string };
  /** Application deadline from the person's official aid notice, YYYY-MM-DD, or '' if not set. */
  deadline: string;
  packet?: { text: string; at: number; where: Where };
}

export const CHECKLIST = [
  { id: 'photos', text: 'Photograph every room before you clean up or throw anything out' },
  { id: 'keep', text: 'Keep damaged items, or a piece of them, until an inspector has seen them' },
  { id: 'register', text: 'Register with your aid program and note your registration number' },
  { id: 'insurer', text: 'Call your insurer and note your claim number' },
  { id: 'receipts', text: 'Keep receipts for hotels, cleanup supplies and repairs' },
  { id: 'docs', text: 'Copy your ID, insurance policy and proof of address' },
];

export const uid = () => crypto.randomUUID();

const DEFAULT_ROOMS = ['Living room', 'Kitchen', 'Bedroom', 'Bathroom', 'Garage', 'Exterior'];

export function newClaim(): Claim {
  return { id: uid(), createdAt: Date.now(), rooms: DEFAULT_ROOMS.map((name) => ({ id: uid(), name, done: false })), items: [], photos: [], expenses: [], checks: [], details: { name: '', address: '', ref: '' }, deadline: '' };
}

// ---------- Derived numbers (pure, tested) ----------

export interface RoomTotal {
  room: Room;
  sum: number;
  count: number;
  photos: number;
  status: 'done' | 'next' | 'started' | 'todo';
}

export function totals(c: Claim) {
  const rooms: RoomTotal[] = c.rooms.map((room) => {
    const items = c.items.filter((i) => i.roomId === room.id);
    return {
      room,
      sum: items.reduce((s, i) => s + (i.estimate ?? 0), 0),
      count: items.length,
      photos: c.photos.filter((p) => p.roomId === room.id).length,
      status: room.done ? 'done' : items.length || c.photos.some((p) => p.roomId === room.id) ? 'started' : 'todo',
    };
  });
  // The next room to work on: the first started-but-not-done room, else the first untouched one.
  const next = rooms.find((r) => r.status === 'started') ?? rooms.find((r) => r.status === 'todo');
  if (next) next.status = 'next';
  const total = rooms.reduce((s, r) => s + r.sum, 0);
  const today = new Date().toDateString();
  const addedToday = c.items.filter((i) => c.photos.find((p) => p.id === i.photoId && new Date(p.takenAt).toDateString() === today)).reduce((s, i) => s + (i.estimate ?? 0), 0);
  return {
    total,
    addedToday,
    rooms,
    next: next?.room,
    roomsDone: rooms.filter((r) => r.status === 'done').length,
    items: c.items.length,
    unestimated: c.items.filter((i) => i.estimate === null).length,
    waiting: c.photos.filter((p) => !p.scanned).length,
    costs: c.expenses.reduce((s, e) => s + (e.amount ?? 0), 0),
  };
}

/** Whole days from `today` until the deadline (0 = due today, negative = passed); null if no deadline. */
export function daysLeft(deadline: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const [y, m, d] = deadline.split('-').map(Number);
  const due = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due - now) / 86_400_000);
}

export const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Spreadsheet export of the inventory and costs, for insurer and aid portals that take CSV. */
export function toCSV(c: Claim): string {
  // Quote every cell; a leading = + - @ would run as a formula in Excel, so prefix it.
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return '"' + (/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"';
  };
  const rows: (string | number | null)[][] = [['Type', 'Room', 'Item', 'Damage', 'Estimate (USD)', 'Date']];
  for (const i of c.items) rows.push(['Item', c.rooms.find((r) => r.id === i.roomId)?.name ?? '', i.name, i.damage, i.estimate, '']);
  for (const e of c.expenses) rows.push(['Expense', '', e.what, '', e.amount, e.date]);
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

// ---------- Persistence ----------

const KEY = 'ar:claim';

export function loadClaim(): Claim {
  try {
    const raw = localStorage.getItem(KEY);
    // Spread over a fresh claim so claims saved by older versions get the newer fields.
    if (raw) return { ...newClaim(), ...(JSON.parse(raw) as Partial<Claim>) };
  } catch {
    /* fall through to a fresh claim */
  }
  return newClaim();
}

export function saveClaim(c: Claim) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage full or blocked: the claim stays in memory for this session */
  }
}

// Minimal IndexedDB store for photo blobs.
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aidready', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = run(d.transaction('photos', mode).objectStore('photos'));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const putPhoto = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id));
export const getPhoto = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id));
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id));
