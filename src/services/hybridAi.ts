/**
 * hybridAi: every AI call in MedBridge goes through Firebase AI Logic with an explicit InferenceMode.
 * - Private data (papers, bottle photos) runs on-device first; public drug data runs cloud first.
 * - Stall protection, session reuse, live online/Nano status, and the Privacy Router policy live here.
 */
/**
 * Hybrid inference engine. Engine detail: each call goes through Firebase AI Logic's
 * getGenerativeModel() with an explicit InferenceMode, and we record where it actually
 * ran (response.inferenceSource) so the UI can show an honest trace.
 */
import { getGenerativeModel, InferenceMode, type GenerativeModel, type Part } from 'firebase/ai';
import { getAIInstance } from './firebase';

export type Mode = (typeof InferenceMode)[keyof typeof InferenceMode];
export { InferenceMode };

export type Where = 'on-device' | 'cloud';

export interface CallResult<T> {
  data: T;
  where: Where;
  ms: number;
}

/** Output languages Gemini Nano in Chrome can currently write. Others are routed to the cloud. */
export const ON_DEVICE_LANGS = ['en', 'es', 'ja'];

export type DeviceState = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported' | 'stalled';

// ---------- Stall protection ----------
// Chrome can report Gemini Nano as "available" while its on-device service is hung. Every call that may
// run on-device is raced against a timeout; after a stall, Nano is skipped for the rest of the session so
// Balanced mode goes straight to the cloud (still on redacted text) instead of making the user wait again.

export class OnDeviceTimeoutError extends Error {
  constructor(seconds: number) {
    super(`Gemini Nano did not respond within ${seconds}s. Tap Try again; restarting Chrome helps if it keeps happening.`);
    this.name = 'OnDeviceTimeoutError';
  }
}

let onDeviceTimeoutMs = 45_000;
export function setOnDeviceTimeout(ms: number) {
  if (ms > 0) onDeviceTimeoutMs = ms;
}

let stalled = false;
const stallListeners = new Set<() => void>();
export function isDeviceStalled() {
  return stalled;
}
export function onDeviceStall(cb: () => void) {
  stallListeners.add(cb);
  return () => stallListeners.delete(cb);
}
function markStalled() {
  if (stalled) return;
  stalled = true;
  stallListeners.forEach((cb) => cb());
}
/** Nano answered (or the person asked to retry): stop treating it as stalled. */
export function clearStall() {
  if (!stalled) return;
  stalled = false;
  stallListeners.forEach((cb) => cb());
}

// The first image call loads Nano's vision model, which took ~60s in testing; later calls take ~12s.
const IMAGE_TIMEOUT_MS = 150_000;

/** Resolves with the promise, or rejects if no progress is reported within the on-device budget. */
function guard<T>(mode: Mode, run: (progress: () => void) => Promise<T>, budgetMs = onDeviceTimeoutMs): Promise<T> {
  if (mode === 'only_in_cloud') return run(() => {});
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    let timedOut = false;
    const arm = () => {
      // A call that already timed out can keep streaming; it must not re-arm and mark Nano stalled again.
      if (timedOut) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        markStalled();
        reject(new OnDeviceTimeoutError(Math.round(budgetMs / 1000)));
      }, budgetMs);
    };
    arm();
    run(arm).then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e))
    );
  });
}

interface LanguageModelStatic {
  availability(opts?: object): Promise<string>;
}

function languageModelApi(): LanguageModelStatic | undefined {
  return (globalThis as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel;
}

/** Asks Chrome directly whether Gemini Nano is ready, so the UI can show status before any call. */
export async function getDeviceState(): Promise<DeviceState> {
  const lm = languageModelApi();
  if (!lm) return 'unsupported';
  if (stalled) return 'stalled';
  try {
    const a = await lm.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
    if (a === 'available' || a === 'downloadable' || a === 'downloading') return a;
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

let cloudModel = 'gemini-3.5-flash-lite';
export function setCloudModel(name: string) {
  cloudModel = name;
}

interface ModelOptions {
  mode: Mode;
  /** JSON schema used both as the cloud responseJsonSchema and the on-device responseConstraint. */
  schema?: object;
  outLang?: string;
  image?: boolean;
  temperature?: number;
}

/**
 * Models are cached per configuration. Each GenerativeModel's Chrome adapter keeps its last Gemini Nano
 * session alive and destroys it only when that same model creates the next one. Building a fresh model per
 * call leaked one live on-device session per request, and after a few runs Chrome's on-device service hung.
 */
const modelCache = new Map<string, GenerativeModel>();

function buildModel(o: ModelOptions): GenerativeModel {
  const lang = o.outLang && ON_DEVICE_LANGS.includes(o.outLang) ? o.outLang : 'en';
  const key = JSON.stringify([o.mode, lang, !!o.image, o.temperature ?? 0.2, cloudModel, o.schema ?? null]);
  const cached = modelCache.get(key);
  if (cached) return cached;
  const model = createModel(o, lang);
  modelCache.set(key, model);
  return model;
}

function createModel(o: ModelOptions, lang: string): GenerativeModel {
  return getGenerativeModel(getAIInstance(), {
    mode: o.mode,
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        temperature: o.temperature ?? 0.2,
        ...(o.schema ? { responseMimeType: 'application/json', responseJsonSchema: o.schema as Record<string, unknown> } : {}),
      },
    },
    onDeviceParams: {
      createOptions: {
        expectedInputs: o.image ? [{ type: 'text', languages: ['en'] }, { type: 'image' }] : [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: [lang] }],
      },
      promptOptions: o.schema ? { responseConstraint: o.schema } : undefined,
    },
  });
}

/** Downloads Gemini Nano. Must be called from a user gesture (Chrome requirement). */
export async function enableOnDevice(onProgress: (p: number) => void): Promise<void> {
  await buildModel({ mode: InferenceMode.PREFER_ON_DEVICE }).initializeDeviceModel(onProgress);
}

function whereFrom(source: string | undefined, mode: Mode): Where {
  if (source === 'on_device') return 'on-device';
  if (source === 'in_cloud') return 'cloud';
  return mode === InferenceMode.ONLY_ON_DEVICE ? 'on-device' : 'cloud';
}

export function parseJSON<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error('The model returned something that was not valid JSON.');
  }
}

/** One structured call. */
export async function generateJSON<T>(task: string, prompt: string | (string | Part)[], o: ModelOptions): Promise<CallResult<T>> {
  const t0 = performance.now();
  const res = await guard(o.mode, () => buildModel(o).generateContent(prompt), o.image ? IMAGE_TIMEOUT_MS : undefined);
  const where = whereFrom(res.response.inferenceSource, o.mode);
  if (where === 'on-device') clearStall();
  const data = parseJSON<T>(res.response.text());
  return { data, where, ms: Math.round(performance.now() - t0) };
}

/** One free-text call, streamed. */
export async function generateText(
  task: string,
  prompt: string | (string | Part)[],
  o: ModelOptions,
  onChunk: (textSoFar: string) => void
): Promise<CallResult<string>> {
  const t0 = performance.now();
  // Idle timeout: each streamed chunk resets the clock, so long answers are fine; a hung model is not.
  let text = '';
  const final = await guard(o.mode, async (progress) => {
    const res = await buildModel({ ...o, schema: undefined }).generateContentStream(prompt);
    for await (const chunk of res.stream) {
      progress();
      text += chunk.text();
      onChunk(text);
    }
    return res.response;
  }, o.image ? IMAGE_TIMEOUT_MS : undefined);
  const where = whereFrom(final.inferenceSource, o.mode);
  if (where === 'on-device') clearStall();
  return { data: text, where, ms: Math.round(performance.now() - t0) };
}

// ===================== Privacy Router =====================


export type PrivacyMode = 'local' | 'balanced' | 'cloud';

export const PRIVACY_MODES: { id: PrivacyMode; label: string; blurb: string }[] = [
  { id: 'local', label: 'Strict local', blurb: 'Nothing leaves this device. Uses Gemini Nano only.' },
  { id: 'balanced', label: 'Balanced', blurb: 'On-device first. Long or complex jobs go to the cloud with personal details hidden.' },
  { id: 'cloud', label: 'Best quality', blurb: 'Cloud first, still with personal details hidden. Falls back to the device when offline.' },
];

export interface RouteInput {
  privacy: PrivacyMode;
  device: DeviceState;
  chars: number;
  maxOnDeviceChars: number;
  outLang: string;
  onDeviceLangs: string[];
  online: boolean;
}

export type Strategy = 'single' | 'local-map-reduce' | 'blocked';

export interface Route {
  mode: Mode;
  strategy: Strategy;
  /** Where we expect it to run; the SDK reports where it actually ran. */
  expected: 'on-device' | 'cloud';
  reason: string;
  /** Output language actually used (may fall back to English in Strict local). */
  outLang: string;
}

const M = {
  PREFER_ON_DEVICE: 'prefer_on_device',
  ONLY_ON_DEVICE: 'only_on_device',
  ONLY_IN_CLOUD: 'only_in_cloud',
  PREFER_IN_CLOUD: 'prefer_in_cloud',
} as const;

export function decideRoute(i: RouteInput): Route {
  const deviceReady = i.device === 'available';
  const fits = i.chars <= i.maxOnDeviceChars;
  const langOk = i.onDeviceLangs.includes(i.outLang);

  if (i.privacy === 'local') {
    if (!deviceReady) {
      return {
        mode: M.ONLY_ON_DEVICE,
        strategy: 'blocked',
        expected: 'on-device',
        reason:
          i.device === 'stalled'
            ? 'Gemini Nano stopped responding in this browser. Restart Chrome, or switch to Balanced to use the cloud with personal details hidden.'
            : 'Strict local needs Gemini Nano, which is not ready on this device. Turn it on, or switch to Balanced.',
        outLang: i.outLang,
      };
    }
    const outLang = langOk ? i.outLang : 'en';
    const langNote = langOk ? '' : ' Gemini Nano cannot write this language yet, so the answer is in English.';
    if (!fits) {
      return {
        mode: M.ONLY_ON_DEVICE,
        strategy: 'local-map-reduce',
        expected: 'on-device',
        reason: `Long document (${i.chars.toLocaleString()} chars). Splitting it into parts and reading each one on-device, so nothing leaves this device.${langNote}`,
        outLang,
      };
    }
    return { mode: M.ONLY_ON_DEVICE, strategy: 'single', expected: 'on-device', reason: `Strict local: explained by Gemini Nano on this device.${langNote}`, outLang };
  }

  if (i.privacy === 'cloud') {
    return {
      mode: M.PREFER_IN_CLOUD,
      strategy: 'single',
      expected: i.online ? 'cloud' : 'on-device',
      reason: i.online
        ? 'Best quality: sent to the cloud with personal details already hidden.'
        : 'Offline, so the SDK falls back to Gemini Nano on this device.',
      outLang: i.outLang,
    };
  }

  // Balanced
  if (!i.online) {
    return {
      mode: M.ONLY_ON_DEVICE,
      strategy: deviceReady ? (fits ? 'single' : 'local-map-reduce') : 'blocked',
      expected: 'on-device',
      reason: deviceReady ? 'Offline: explained on-device.' : 'Offline and Gemini Nano is not ready on this device, so this cannot run right now.',
      outLang: langOk ? i.outLang : 'en',
    };
  }
  if (deviceReady && fits && langOk) {
    return {
      mode: M.PREFER_ON_DEVICE,
      strategy: 'single',
      expected: 'on-device',
      reason: `Short document (${i.chars.toLocaleString()} chars): Gemini Nano on this device. If it can't run, the SDK falls back to the cloud.`,
      outLang: i.outLang,
    };
  }
  const why = !deviceReady
    ? i.device === 'stalled'
      ? 'Gemini Nano stopped responding in this browser'
      : 'Gemini Nano is not ready on this device'
    : !fits
      ? `the document is long (${i.chars.toLocaleString()} chars, on-device limit ${i.maxOnDeviceChars.toLocaleString()})`
      : 'Gemini Nano cannot write this language yet';
  return {
    mode: M.ONLY_IN_CLOUD,
    strategy: 'single',
    expected: 'cloud',
    reason: `Cloud, because ${why}. Only the version with personal details hidden is sent.`,
    outLang: i.outLang,
  };
}

/** Splits text on paragraph boundaries into chunks of roughly `size` characters. */
export function chunkText(text: string, size: number): string[] {
  const paras = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > size) {
      chunks.push(cur);
      cur = '';
    }
    if (p.length > size) {
      for (let i = 0; i < p.length; i += size) chunks.push(p.slice(i, i + size));
      continue;
    }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// ===================== Live status (online / on-device) =====================

export interface HybridStatus {
  online: boolean;
  device: DeviceState;
}

/**
 * Calls `cb` with connectivity and Gemini Nano state now, and again whenever either changes
 * (going offline/online, Nano finishing a download, or Nano stalling). Returns an unsubscribe function.
 */
export function subscribeHybridStatus(cb: (s: HybridStatus) => void): () => void {
  let device: DeviceState = 'unsupported';
  const emit = () => cb({ online: navigator.onLine, device: isDeviceStalled() ? 'stalled' : device });
  const refresh = () =>
    getDeviceState().then((d) => {
      device = d;
      emit();
    });
  refresh();
  const onNet = () => refresh();
  addEventListener('online', onNet);
  addEventListener('offline', onNet);
  const offStall = onDeviceStall(refresh);
  return () => {
    removeEventListener('online', onNet);
    removeEventListener('offline', onNet);
    offStall();
  };
}
