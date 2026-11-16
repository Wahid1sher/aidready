import { useState } from 'react';
import { ArrowRight, Camera, Check, FileText, Plus, Receipt } from 'lucide-react';
import type { Ctx } from '../App';
import { CHECKLIST, daysLeft, money, totals, uid } from '../lib/claim';
import { StatusPill } from './StatusPill';
import { Logo } from './Logo';

const SEG = ['#2f6bff', '#7aa2ff', '#c7d6ff'];

export function Amount({ n, big }: { n: number; big?: boolean }) {
  return (
    <span className={big ? 'amt' : 'mono'}>
      {money(n)}
      {big && <span>.00</span>}
    </span>
  );
}

export function Home(c: Ctx) {
  const t = totals(c.claim);
  const days = daysLeft(c.claim.deadline);
  const [editDate, setEditDate] = useState(false);
  const ranked = t.rooms.filter((r) => r.sum > 0).sort((a, b) => b.sum - a.sum);
  const top = ranked.slice(0, 3);
  const rest = t.rooms.filter((r) => !top.includes(r));
  const restSum = rest.reduce((s, r) => s + r.sum, 0);
  const todayRooms = c.claim.rooms.filter((r) => c.claim.items.some((i) => i.roomId === r.id && c.claim.photos.some((p) => p.id === i.photoId && new Date(p.takenAt).toDateString() === new Date().toDateString())));
  const todayRoom = todayRooms.length === 1 ? todayRooms[0] : undefined;
  const due = c.claim.deadline ? new Date(c.claim.deadline + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <main className="screen">
      <header className="top">
        <div className="logo">
          <Logo />
          AidReady
        </div>
        <StatusPill {...c} />
      </header>

      <p className="lbl">Documented damage</p>
      <Amount n={t.total} big />
      {t.addedToday > 0 && <div className="delta">+ {money(t.addedToday)}{todayRoom ? ` ${todayRoom.name.toLowerCase()}` : ''}, today</div>}

      <div className="bar" role="img" aria-label="Damage by room">
        {t.total > 0 &&
          top.map((r, i) => <i key={r.room.id} style={{ width: `${(r.sum / t.total) * 100}%`, background: SEG[i] }} />)}
        {t.total > 0 && restSum > 0 && <i style={{ width: `${(restSum / t.total) * 100}%`, background: '#dfe3ea' }} />}
      </div>
      <div className="keys">
        {top.map((r, i) => (
          <span key={r.room.id} style={{ '--c': SEG[i] } as React.CSSProperties}>
            {r.room.name} {money(r.sum)}
          </span>
        ))}
        {rest.length > 0 && (
          <span style={{ '--c': '#eef0f3' } as React.CSSProperties}>
            {top.length ? rest.map((r) => r.room.name.toLowerCase()).slice(0, 2).join(', ') + (rest.length > 2 ? ` +${rest.length - 2}` : '') : 'Scan a room to start'}
          </span>
        )}
      </div>

      <section className="card" aria-label="Rooms">
        {t.rooms.map((r) => (
          <button key={r.room.id} className="ln" onClick={() => c.setView({ name: 'room', id: r.room.id })}>
            <div>
              {r.room.name}
              <small>{r.count || r.photos ? `${r.count} items · ${r.photos} photos` : 'Not started'}</small>
            </div>
            <span className="mono">{r.sum ? money(r.sum) : '—'}</span>
            <span className={`st ${r.status === 'done' ? 'ok' : r.status === 'next' ? 'nx' : r.status === 'started' ? 'nx' : 'td'}`}>
              {r.status === 'done' ? 'Done' : r.status === 'next' ? 'Next' : r.status === 'started' ? 'Started' : 'To do'}
            </span>
          </button>
        ))}
        <button
          className="add"
          onClick={() => {
            const id = uid();
            c.setClaim((x) => ({ ...x, rooms: [...x.rooms, { id, name: `Room ${x.rooms.length + 1}`, done: false }] }));
            c.setView({ name: 'room', id });
          }}
        >
          <Plus size={15} aria-hidden /> Add a room
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
            Deadline from your official aid notice
            <input name="d" type="date" defaultValue={c.claim.deadline} required autoFocus />
          </label>
          <button className="mini">Save</button>
        </form>
      ) : (
        <button className="dl" onClick={() => setEditDate(true)}>
          <span>{days === null ? 'Add your aid application deadline' : days < 0 ? 'Aid application closed' : 'Aid application closes'}</span>
          <b>{days === null ? 'Set date' : days < 0 ? due : `${days} ${days === 1 ? 'day' : 'days'} · ${due}`}</b>
        </button>
      )}

      <button className="row-link" onClick={() => c.setView({ name: 'packet' })} disabled={!t.items}>
        <FileText size={18} aria-hidden />
        <span>
          Claim packet
          <small>{t.items ? `Cover letter, ${t.items} items, ${c.claim.photos.length} photos` : 'Ready once you scan a room'}</small>
        </span>
        <ArrowRight size={16} aria-hidden />
      </button>

      <button className="row-link" onClick={() => c.setView({ name: 'costs' })}>
        <Receipt size={18} aria-hidden />
        <span>
          Extra costs
          <small>{c.claim.expenses.length ? `${c.claim.expenses.length} costs · ${money(t.costs)}` : 'Hotel, cleanup, meals: often paid back'}</small>
        </span>
        <ArrowRight size={16} aria-hidden />
      </button>

      <section className="card checklist" aria-label="Checklist">
        <div className="ck-h">
          <span>Before you clean up</span>
          <span className="mono">
            {c.claim.checks.length}/{CHECKLIST.length}
          </span>
        </div>
        {CHECKLIST.map((s) => {
          const on = c.claim.checks.includes(s.id);
          return (
            <label key={s.id} className={`ck ${on ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => c.setClaim((x) => ({ ...x, checks: on ? x.checks.filter((k) => k !== s.id) : [...x.checks, s.id] }))}
              />
              <span className="box" aria-hidden>
                {on && <Check size={12} strokeWidth={3} />}
              </span>
              {s.text}
            </label>
          );
        })}
      </section>

      <p className="note">Estimates are replacement-cost estimates to help you fill in your claim, not appraisals. Check each one.</p>

      {t.next && (
        <div className="cta-wrap">
          <button className="cta" onClick={() => c.setView({ name: 'room', id: t.next!.id })}>
            <Camera size={18} aria-hidden /> Scan {t.next.name.toLowerCase()}
          </button>
        </div>
      )}
    </main>
  );
}
