import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeHybridStatus, enableOnDevice, type HybridStatus } from './services/hybridAi';
import { loadClaim, saveClaim, putPhoto, getPhoto, uid, type Claim } from './lib/claim';
import { scanPhoto, shrink } from './lib/ai';
import { Home } from './components/Home';
import { RoomView } from './components/RoomView';
import { Packet } from './components/Packet';
import { Costs } from './components/Costs';

export type View = { name: 'home' } | { name: 'room'; id: string } | { name: 'packet' } | { name: 'costs' };

const CLOUD_KEY = 'ar:allowCloud';

export default function App() {
  const [claim, setClaim] = useState<Claim>(loadClaim);
  const [view, setView] = useState<View>({ name: 'home' });
  const [status, setStatus] = useState<HybridStatus>({ online: navigator.onLine, device: 'unsupported' });
  const [allowCloud, setAllowCloud] = useState(() => localStorage.getItem(CLOUD_KEY) !== 'false');
  const [scanning, setScanning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const claimRef = useRef(claim);
  claimRef.current = claim;

  useEffect(() => {
    saveClaim(claim);
  }, [claim]);
  useEffect(() => subscribeHybridStatus(setStatus), []);
  useEffect(() => {
    localStorage.setItem(CLOUD_KEY, String(allowCloud));
  }, [allowCloud]);
  useEffect(() => {
    scrollTo(0, 0);
  }, [view]);

  const canRead = status.device === 'available' || (status.online && allowCloud);

  /** Reads waiting photos one at a time, oldest first. Photos that can't be read now stay saved for later. */
  const drain = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setError('');
    try {
      for (;;) {
        const p = claimRef.current.photos.find((x) => !x.scanned);
        if (!p) break;
        setScanning(p.id);
        const blob = await getPhoto(p.id);
        if (!blob) {
          setClaim((c) => ({ ...c, photos: c.photos.map((x) => (x.id === p.id ? { ...x, scanned: true } : x)) }));
          continue;
        }
        const { items, where } = await scanPhoto(blob, allowCloud && navigator.onLine);
        setClaim((c) => ({
          ...c,
          photos: c.photos.map((x) => (x.id === p.id ? { ...x, scanned: true } : x)),
          items: [...c.items, ...items.map((i) => ({ ...i, id: uid(), roomId: p.roomId, photoId: p.id, estimateBy: i.estimate === null ? null : ('ai' as const), where }))],
        }));
        claimRef.current = { ...claimRef.current, photos: claimRef.current.photos.map((x) => (x.id === p.id ? { ...x, scanned: true } : x)) };
      }
    } catch (e) {
      setError(`Couldn't read a photo: ${(e as Error).message}. It's saved and will be read later.`);
    } finally {
      busy.current = false;
      setScanning(null);
    }
  }, [allowCloud]);

  // Pick up waiting photos as soon as there's a way to read them (signal returns, or on-device AI is ready).
  useEffect(() => {
    if (canRead && claim.photos.some((p) => !p.scanned)) drain();
  }, [canRead, drain, claim.photos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addPhotos(roomId: string, files: FileList) {
    const added = [];
    for (const f of Array.from(files)) {
      const id = uid();
      await putPhoto(id, await shrink(f));
      added.push({ id, roomId, takenAt: Date.now(), scanned: false });
    }
    const next = { ...claimRef.current, photos: [...claimRef.current.photos, ...added] };
    claimRef.current = next;
    setClaim(next);
  }

  const ctx = { claim, setClaim, status, allowCloud, setAllowCloud, scanning, error, canRead, setView, addPhotos, drain, enableNano: enableOnDevice };

  return (
    <div className="app">
      {view.name === 'home' && <Home {...ctx} />}
      {view.name === 'room' && <RoomView {...ctx} roomId={view.id} />}
      {view.name === 'packet' && <Packet {...ctx} />}
      {view.name === 'costs' && <Costs {...ctx} />}
    </div>
  );
}

export type Ctx = {
  claim: Claim;
  setClaim: React.Dispatch<React.SetStateAction<Claim>>;
  status: HybridStatus;
  allowCloud: boolean;
  setAllowCloud: (v: boolean) => void;
  scanning: string | null;
  error: string;
  canRead: boolean;
  setView: (v: View) => void;
  addPhotos: (roomId: string, files: FileList) => Promise<void>;
  drain: () => void;
  enableNano: typeof enableOnDevice;
};
