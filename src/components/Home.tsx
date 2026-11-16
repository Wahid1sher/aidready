import { useState } from 'react';
import { ArrowRight, Camera, Check, Download, FileText, Plus, Receipt, ShieldCheck, Upload } from 'lucide-react';
import type { Ctx } from '../App';
import { CHECKLIST, daysLeft, money, totals, uid } from '../lib/claim';
import { findGaps } from '../lib/checkup';
import { makeBackup, restoreBackup } from '../lib/backup';
import { locale, s } from '../lib/i18n';
import { StatusPill } from './StatusPill';
import { Logo } from './Logo';

const SEG = ['#2f6bff', '#7aa2ff', '#c7d6ff'];

export function Home(c: Ctx) {
  const t = totals(c.claim);
  const days = daysLeft(c.claim.deadline);
  const gaps = findGaps(c.claim);
  const urgent = gaps.filter((g) => g.level === 'urgent').length;
  const [editDate, setEditDate] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const ranked = t.rooms.filter((r) => r.sum > 0).sort((a, b) => b.sum - a.sum);
  const top = ranked.slice(0, 3);
  const rest = t.rooms.filter((r) => !top.includes(r));
  const restSum = rest.reduce((n, r) => n + r.sum, 0);
  const todayStr = new Date().toDateString();
  const todayRooms = c.claim.rooms.filter((r) => c.claim.items.some((i) => i.roomId === r.id && c.claim.photos.some((p) => p.id === i.photoId && new Date(p.takenAt).toDateString() === todayStr)));
  const todayRoom = todayRooms.length === 1 ? todayRooms[0] : undefined;
  const due = c.claim.deadline ? new Date(c.claim.deadline + 'T12:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }) : '';

  async function saveBackup() {
    setBackupMsg(s('Preparing backup…'));
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await makeBackup(c.claim));
      a.download = `aidready-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setBackupMsg(s('Backup saved. Keep it somewhere safe, like email or cloud storage.'));
    } catch (e) {
      setBackupMsg(s("Couldn't make the backup: {msg}", { msg: (e as Error).message }));
    }
  }

  async function restore(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    if ((c.claim.items.length || c.claim.photos.length) && !confirm(s('Replace the claim on this device with the backup? The current claim will be lost.'))) return;
    try {
      c.replaceClaim(await restoreBackup(f));
      setBackupMsg(s('Backup restored.'));
    } catch (e) {
      setBackupMsg((e as Error).message);
    }
  }

  const statusLabel = { done: 'Done', next: 'Next', started: 'Started', todo: 'To do' } as const;

  return (
    <main className="screen">
      <header className="top">
        <div className="logo">
          <Logo />
          AidReady
        </div>
        <div className="top-r">
          <div className="lang" role="group" aria-label={s('Language')}>
            {(['en', 'es'] as const).map((l) => (
              <button key={l} aria-pressed={c.lang === l} onClick={() => c.changeLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <StatusPill {...c} />
        </div>
      </header>

      <p className="lbl">{s('Documented damage')}</p>
      <span className="amt">
        {money(t.total)}
        <span>.00</span>
      </span>
      {t.addedToday > 0 && (
        <div className="delta">
          + {money(t.addedToday)}
          {todayRoom ? ` ${s(todayRoom.name).toLowerCase()}` : ''}, {s('today')}
        </div>
      )}

      <div className="bar" role="img" aria-label={s('Damage by room')}>
        {t.total > 0 && top.map((r, i) => <i key={r.room.id} style={{ width: `${(r.sum / t.total) * 100}%`, background: SEG[i] }} />)}
        {t.total > 0 && restSum > 0 && <i style={{ width: `${(restSum / t.total) * 100}%`, background: '#dfe3ea' }} />}
      </div>
      <div className="keys">
        {top.map((r, i) => (
          <span key={r.room.id} style={{ '--c': SEG[i] } as React.CSSProperties}>
            {s(r.room.name)} {money(r.sum)}
          </span>
        ))}
        {rest.length > 0 && (
          <span style={{ '--c': '#eef0f3' } as React.CSSProperties}>
            {top.length
              ? rest
                  .map((r) => s(r.room.name).toLowerCase())
                  .slice(0, 2)
                  .join(', ') + (rest.length > 2 ? ` +${rest.length - 2}` : '')
              : s('Scan a room to start')}
          </span>
        )}
      </div>

      <section className="card" aria-label={s('Rooms')}>
        {t.rooms.map((r) => (
          <button key={r.room.id} className="ln" onClick={() => c.setView({ name: 'room', id: r.room.id })}>
            <div>
              {s(r.room.name)}
              <small>{r.count || r.photos ? s('{n} items · {p} photos', { n: r.count, p: r.photos }) : s('Not started')}</small>
            </div>
            <span className="mono">{r.sum ? money(r.sum) : '—'}</span>
            <span className={`st ${r.status === 'done' ? 'ok' : r.status === 'todo' ? 'td' : 'nx'}`}>{s(statusLabel[r.status])}</span>
          </button>
        ))}
        <button
          className="add"
          onClick={() => {
            const id = uid();
            c.setClaim((x) => ({ ...x, rooms: [...x.rooms, { id, name: s('Room {n}', { n: x.rooms.length + 1 }), done: false }] }));
            c.setView({ name: 'room', id });
          }}
        >
          <Plus size={15} aria-hidden /> {s('Add a room')}
        </button>
      </section>

      {editDate ? (
        <form
          className="dl dl-edit"
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get('d') as string;
            c.setClaim((x) => ({ ...x, deadline: v }));
            setEditDate(false);
          }}
        >
          <label>
            {s('Deadline from your official aid notice')}
            <input name="d" type="date" defaultValue={c.claim.deadline} required autoFocus />
          </label>
          <button className="mini">{s('Save')}</button>
        </form>
      ) : (
        <button className="dl" onClick={() => setEditDate(true)}>
          <span>{days === null ? s('Add your aid application deadline') : days < 0 ? s('Aid application closed') : s('Aid application closes')}</span>
          <b>{days === null ? s('Set date') : days < 0 ? due : `${s(days === 1 ? '{n} day' : '{n} days', { n: days })} · ${due}`}</b>
        </button>
      )}

      <button className="row-link" onClick={() => c.setView({ name: 'checkup' })}>
        <ShieldCheck size={18} aria-hidden className={urgent ? 'warn-ic' : gaps.length ? '' : 'ok-ic'} />
        <span>
          {s('Claim checkup')}
          <small>{gaps.length ? s('{n} things to look at', { n: gaps.length }) + (urgent ? ` · ${s('{n} urgent', { n: urgent })}` : '') : s('All clear')}</small>
        </span>
        <ArrowRight size={16} aria-hidden />
      </button>

      <button className="row-link" onClick={() => c.setView({ name: 'packet' })} disabled={!t.items}>
        <FileText size={18} aria-hidden />
        <span>
          {s('Claim packet')}
          <small>{t.items ? s('Cover letter, {n} items, {p} photos', { n: t.items, p: c.claim.photos.length }) : s('Ready once you scan a room')}</small>
        </span>
        <ArrowRight size={16} aria-hidden />
      </button>

      <button className="row-link" onClick={() => c.setView({ name: 'costs' })}>
        <Receipt size={18} aria-hidden />
        <span>
          {s('Extra costs')}
          <small>{c.claim.expenses.length ? s('{n} costs · {sum}', { n: c.claim.expenses.length, sum: money(t.costs) }) : s('Hotel, cleanup, meals: often paid back')}</small>
        </span>
        <ArrowRight size={16} aria-hidden />
      </button>

      <section className="card checklist" aria-label={s('Checklist')}>
        <div className="ck-h">
          <span>{s('Before you clean up')}</span>
          <span className="mono">
            {c.claim.checks.length}/{CHECKLIST.length}
          </span>
        </div>
        {CHECKLIST.map((step) => {
          const on = c.claim.checks.includes(step.id);
          return (
            <label key={step.id} className={`ck ${on ? 'on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => c.setClaim((x) => ({ ...x, checks: on ? x.checks.filter((k) => k !== step.id) : [...x.checks, step.id] }))} />
              <span className="box" aria-hidden>
                {on && <Check size={12} strokeWidth={3} />}
              </span>
              {s(step.text)}
            </label>
          );
        })}
      </section>

      <section className="card backup" aria-label={s('Backup')}>
        <div className="ck-h">
          <span>{s('Backup')}</span>
          <span className="muted">{s('Claim and photos in one file')}</span>
        </div>
        <p className="bk-note">{s('Everything lives on this phone. Save a backup so a lost or broken phone does not lose your claim.')}</p>
        <div className="bk-row">
          <button className="mini" onClick={saveBackup}>
            <Download size={14} aria-hidden /> {s('Save backup')}
          </button>
          <label className="mini">
            <Upload size={14} aria-hidden /> {s('Restore')}
            <input type="file" accept="application/json,.json" onChange={restore} hidden />
          </label>
        </div>
        {backupMsg && (
          <p className="bk-msg" role="status">
            {backupMsg}
          </p>
        )}
      </section>

      <p className="note">{s('Estimates are replacement-cost estimates to help you fill in your claim, not appraisals. Check each one.')}</p>

      {t.next && (
        <div className="cta-wrap">
          <button className="cta" onClick={() => c.setView({ name: 'room', id: t.next!.id })}>
            <Camera size={18} aria-hidden /> {s('Scan {room}', { room: s(t.next.name).toLowerCase() })}
          </button>
        </div>
      )}
    </main>
  );
}
