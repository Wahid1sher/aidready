import { ArrowLeft, Camera, Check, Cpu, Cloud, Images, Plus, Trash2 } from 'lucide-react';
import type { Ctx } from '../App';
import { deletePhoto, money, uid, type Item } from '../lib/claim';
import { Thumb } from './Thumb';

export function RoomView(c: Ctx & { roomId: string }) {
  const room = c.claim.rooms.find((r) => r.id === c.roomId);
  if (!room) return null;
  const photos = c.claim.photos.filter((p) => p.roomId === room.id);
  const items = c.claim.items.filter((i) => i.roomId === room.id);
  const sum = items.reduce((s, i) => s + (i.estimate ?? 0), 0);
  const waiting = photos.filter((p) => !p.scanned).length;

  const edit = (id: string, patch: Partial<Item>) => c.setClaim((x) => ({ ...x, items: x.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const remove = (id: string) => c.setClaim((x) => ({ ...x, items: x.items.filter((i) => i.id !== id) }));
  const removePhoto = (id: string) => {
    deletePhoto(id).catch(() => {});
    c.setClaim((x) => ({ ...x, photos: x.photos.filter((p) => p.id !== id), items: x.items.filter((i) => i.photoId !== id) }));
  };
  const addManual = () =>
    c.setClaim((x) => ({ ...x, items: [...x.items, { id: uid(), roomId: room.id, photoId: '', name: '', damage: '', estimate: null, estimateBy: null, where: 'on-device' }] }));
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) c.addPhotos(room.id, e.target.files);
    e.target.value = '';
  };

  return (
    <main className="screen">
      <header className="top">
        <button className="back" onClick={() => c.setView({ name: 'home' })}>
          <ArrowLeft size={18} aria-hidden /> Claim
        </button>
        <span className={`st ${room.done ? 'ok' : 'nx'}`}>{room.done ? 'Done' : 'In progress'}</span>
      </header>

      <p className="lbl">{room.name}</p>
      <span className="amt">
        {money(sum)}
        <span>.00</span>
      </span>
      <p className="sub">
        {items.length} items · {photos.length} photos
      </p>

      <div className="shoot">
        <label className="cta">
          <Camera size={18} aria-hidden /> Take photos
          <input type="file" accept="image/*" capture="environment" multiple onChange={onFiles} hidden />
        </label>
        <label className="ghost">
          <Images size={18} aria-hidden /> From gallery
          <input type="file" accept="image/*" multiple onChange={onFiles} hidden />
        </label>
      </div>
      <p className="tip">One photo per wall works best. Get close to damage and include water lines.</p>

      {waiting > 0 && (
        <div className={`queue ${c.scanning ? 'busy' : ''}`} role="status">
          {c.scanning
            ? `Reading photo ${photos.findIndex((p) => p.id === c.scanning) + 1} of ${photos.length}…`
            : c.canRead
              ? `${waiting} photo${waiting > 1 ? 's' : ''} waiting`
              : `${waiting} photo${waiting > 1 ? 's' : ''} saved on this device. They'll be read when you have signal or on-device AI.`}
          {!c.scanning && c.canRead && (
            <button className="mini" onClick={c.drain}>
              Read now
            </button>
          )}
        </div>
      )}
      {c.error && <p className="err">{c.error}</p>}

      {photos.length > 0 && (
        <div className="thumbs">
          {photos.map((p, n) => (
            <figure key={p.id} className={p.scanned ? '' : 'wait'}>
              <Thumb id={p.id} alt={`${room.name} photo ${n + 1}`} />
              <button aria-label={`Delete photo ${n + 1} and its items`} onClick={() => removePhoto(p.id)}>
                <Trash2 size={13} />
              </button>
            </figure>
          ))}
        </div>
      )}

      <section className="card items" aria-label="Damaged items">
        {items.length === 0 && <p className="empty">Items the AI finds in your photos show up here. You can edit every one.</p>}
        {items.map((i) => (
          <div key={i.id} className="item">
            <div className="item-main">
              <input className="in-name" value={i.name} placeholder="Item" aria-label="Item name" onChange={(e) => edit(i.id, { name: e.target.value })} />
              <input className="in-dmg" value={i.damage} placeholder="Damage" aria-label="Damage" onChange={(e) => edit(i.id, { damage: e.target.value })} />
              <span className="src">
                {i.photoId ? (i.where === 'on-device' ? <Cpu size={11} aria-hidden /> : <Cloud size={11} aria-hidden />) : null}
                {i.photoId ? (i.where === 'on-device' ? 'Read on device' : 'Read in cloud') : 'Added by you'}
                {i.estimateBy === 'ai' && ' · AI estimate'}
              </span>
            </div>
            <label className="est">
              <span>$</span>
              <input
                inputMode="numeric"
                value={i.estimate ?? ''}
                placeholder="—"
                aria-label={`Estimate for ${i.name || 'item'}`}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  edit(i.id, { estimate: v ? Number(v) : null, estimateBy: v ? 'you' : null });
                }}
              />
            </label>
            <button className="icon" aria-label={`Remove ${i.name || 'item'}`} onClick={() => remove(i.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button className="add" onClick={addManual}>
          <Plus size={15} aria-hidden /> Add an item by hand
        </button>
      </section>

      <button
        className={room.done ? 'ghost wide' : 'dark wide'}
        onClick={() => c.setClaim((x) => ({ ...x, rooms: x.rooms.map((r) => (r.id === room.id ? { ...r, done: !r.done } : r)) }))}
      >
        <Check size={17} aria-hidden /> {room.done ? 'Reopen room' : 'Mark room done'}
      </button>
    </main>
  );
}
