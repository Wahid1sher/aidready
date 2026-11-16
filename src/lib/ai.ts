import { generateJSON, generateText, InferenceMode, type Where } from '../services/hybridAi';
import { money, totals, type Claim } from './claim';

export interface ScannedItem {
  name: string;
  damage: string;
  estimate: number | null;
}

const ITEMS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          damage: { type: 'string' },
          estimate: { type: 'number' },
        },
        required: ['name', 'damage', 'estimate'],
      },
    },
  },
  required: ['items'],
};

const SCAN_PROMPT = `You help a disaster survivor document damaged belongings for an aid or insurance claim.
Look at this photo of a room in their home. List each damaged household item you can clearly see.
For each item give:
- name: short and specific, e.g. "Fabric sofa, 3-seat"
- damage: what is visibly wrong, in a few words, e.g. "Water line 40 cm, mud on cushions"
- estimate: a rough replacement cost in whole US dollars for a typical mid-range new item; 0 if you cannot tell
Only list items you can actually see in the photo. Do not guess about things out of frame. At most 12 items.
Reply as JSON: {"items":[{"name":"...","damage":"...","estimate":0}]}`;

/** Shrinks a photo so on-device AI reads it fast and IndexedDB stays small. */
export async function shrink(file: Blob, max = 1280): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
}

async function base64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Reads one room photo into a list of damaged items. Photos stay on this device unless cloud is allowed. */
export async function scanPhoto(photo: Blob, allowCloud: boolean): Promise<{ items: ScannedItem[]; where: Where }> {
  const r = await generateJSON<{ items: ScannedItem[] }>(
    'scan',
    [SCAN_PROMPT, { type: 'inlineData', inlineData: { data: await base64(photo), mimeType: 'image/jpeg' } }],
    { mode: allowCloud ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_ON_DEVICE, schema: ITEMS_SCHEMA, image: true, temperature: 0 }
  );
  return { items: cleanItems(r.data.items), where: r.where };
}

/** Model output is untrusted: trim, cap, and turn 0 / nonsense estimates into "unknown". */
export function cleanItems(raw: unknown): ScannedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is ScannedItem => !!i && typeof i.name === 'string' && i.name.trim() !== '')
    .slice(0, 12)
    .map((i) => {
      const n = Number(i.estimate);
      return {
        name: i.name.trim().slice(0, 80),
        damage: String(i.damage ?? '').trim().slice(0, 120),
        estimate: Number.isFinite(n) && n > 0 && n < 100_000 ? Math.round(n) : null,
      };
    });
}

/** The facts the cover letter may use. Every number comes from the claim, never from the model. */
export function packetFacts(c: Claim) {
  const t = totals(c);
  const rooms = t.rooms.filter((r) => r.count > 0).map((r) => `${r.room.name}: ${r.count} items, ${money(r.sum)}`);
  return `Total documented damage: ${money(t.total)} across ${t.items} items.
Rooms: ${rooms.join('; ') || 'none yet'}.
${t.costs ? `Extra out-of-pocket costs (hotel, cleanup and similar): ${money(t.costs)}.
` : ''}${t.unestimated ? `Items still needing an estimate: ${t.unestimated}.\n` : ''}Photos attached: ${c.photos.length}.`;
}

/** Drafts the cover letter. Cloud gives the best writing; on-device works too when offline. */
export async function draftLetter(c: Claim, allowCloud: boolean, onChunk: (t: string) => void) {
  const prompt = `Write a short, plain cover letter (under 180 words) a household can send with their disaster damage inventory to an aid agency or insurer.
Use only these facts; do not invent names, addresses, dates, policy numbers or amounts:
${packetFacts(c)}
Leave [Your name], [Address] and [Claim or registration number] as placeholders.
Say the attached inventory lists each item with photos, and that estimates are replacement-cost estimates, not appraisals.
No markdown.`;
  return generateText('letter', prompt, { mode: allowCloud ? InferenceMode.PREFER_IN_CLOUD : InferenceMode.ONLY_ON_DEVICE, temperature: 0.3 }, onChunk);
}
