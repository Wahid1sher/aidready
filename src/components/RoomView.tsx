import { ArrowLeft, Camera, Check, Cpu, Cloud, Images, Plus, Trash2 } from 'lucide-react';
import type { Ctx } from '../App';
import { s } from '../lib/i18n';
import { clearStall } from '../services/hybridAi';
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
  const removeRoom = () => {
    if (photos.length + items.length && !confirm(s("Delete {room} with its {n} items and {p} photos? This can't be undone.", { room: s(room.name), n: items.length, p: photos.length }))) return;
    photos.forEach((p) => deletePhoto(p.id).catch(() => {}));
    c.setClaim((x) => ({ ...x, rooms: x.rooms.filter((r) => r.id !== room.id), photos: x.photos.filter((p) => p.roomId !== room.id), items: x.items.filter((i) => i.roomId !== room.id) }));
    c.setView({ name: 'home' });
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
          <ArrowLeft size={18} aria-hidden /> {s('Claim')}
        </button>
        <span className={`st ${room.done ? 'ok' : 'nx'}`}>{room.done ? s('Done') : s('In progress')}</span>
      </header>

      <input
        className="lbl room-name"
        value={s(room.name)}
        aria-label={s('Room name')}
        onChange={(e) => c.setClaim((x) => ({ ...x, rooms: x.rooms.map((r) => (r.id === room.id ? { ...r, name: e.target.value } : r)) }))}
      />
      <span className="amt">
        {money(sum)}
        <span>.00</span>
      </span>
      <p className="sub">
        {s('{n} items · {p} photos', { n: items.length, p: photos.length })}
      </p>

      <div className="shoot">
        <label className="cta">
          <Camera size={18} aria-hidden /> {s('Take photos')}
          <input type="file" accept="image/*" capture="environment" multiple onChange={onFiles} hidden />
        </label>
        <label className="ghost">
          <Images size={18} aria-hidden /> {s('From gallery')}
          <input type="file" accept="image/*" multiple onChange={onFiles} hidden />
        </label>
      </div>
      <p className="tip">{s('One photo per wall works best. Get close to damage and include water lines.')}</p>

      {waiting > 0 && (
        <div className={`queue ${c.scanning ? 'busy' : ''}`} role="status">
          {c.scanning
            ? s('Reading photo {n} of {total}…', { n: photos.findIndex((p) => p.id === c.scanning) + 1, total: photos.length })
            : c.canRead
              ? s('{n} photos waiting', { n: waiting })
              : s("{n} photos saved on this device. They'll be read when you have signal or on-device AI.", { n: waiting })}
          {!c.scanning && !c.canRead && c.status.device === 'stalled' && (
            <button className="mini" onClick={clearStall}>
              {s('Try again')}
            </button>
          )}
          {!c.scanning && c.canRead && (
            <button className="mini" onClick={c.drain}>
              {s('Read now')}
            </button>
          )}
        </div>
      )}
      {c.error && <p className="err">{c.error}</p>}

      {photos.length > 0 && (
        <div className="thumbs">
          {photos.map((p, n) => (
            <figure key={p.id} className={p.scanned ? '' : 'wait'}>
              <Thumb id={p.id} alt={s('{room} photo {n}', { room: s(room.name), n: n + 1 })} />
              <button aria-label={s('Delete photo {n} and its items', { n: n + 1 })} onClick={() => removePhoto(p.id)}>
                <Trash2 size={13} />
              </button>
            </figure>
          ))}
        </div>
      )}

      <section className="card items" aria-label={s('Damaged items')}>
        {items.length === 0 && <p className="empty">{s('Items the AI finds in your photos show up here. You can edit every one.')}</p>}
        {items.map((i) => (
          <div key={i.id} className="item">
            <div className="item-main">
              <input className="in-name" value={i.name} placeholder={s('Item')} aria-label={s('Item name')} onChange={(e) => edit(i.id, { name: e.target.value })} />
              <input className="in-dmg" value={i.damage} placeholder={s('Damage')} aria-label={s('Damage')} onChange={(e) => edit(i.id, { damage: e.target.value })} />
              <span className="src">
                {i.photoId ? (i.where === 'on-device' ? <Cpu size={11} aria-hidden /> : <Cloud size={11} aria-hidden />) : null}
                {i.photoId ? (i.where === 'on-device' ? s('Read on device') : s('Read in cloud')) : s('Added by you')}
                {i.estimateBy === 'ai' && ` · ${s('AI estimate')}`}
              </span>
            </div>
            <label className="est">
              <span>$</span>
              <input
                inputMode="numeric"
                value={i.estimate ?? ''}
                placeholder="—"
                aria-label={s('Estimate for {what}', { what: i.name || s('item') })}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  edit(i.id, { estimate: v ? Number(v) : null, estimateBy: v ? 'you' : null });
                }}
              />
            </label>
            <button className="icon" aria-label={s('Remove {what}', { what: i.name || s('item') })} onClick={() => remove(i.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button className="add" onClick={addManual}>
          <Plus size={15} aria-hidden /> {s('Add an item by hand')}
        </button>
      </section>

      <button
        className={room.done ? 'ghost wide' : 'dark wide'}
        onClick={() => {
          c.setClaim((x) => ({ ...x, rooms: x.rooms.map((r) => (r.id === room.id ? { ...r, done: !r.done } : r)) }));
          if (!room.done) c.setView({ name: 'home' });
        }}
      >
        <Check size={17} aria-hidden /> {room.done ? s('Reopen room') : s('Mark room done')}
      </button>
      <button className="link-danger" onClick={removeRoom}>
        {s('Delete this room')}
      </button>
    </main>
  );
}
