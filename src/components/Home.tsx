import { useState } from 'react';
import { ArrowRight, Camera, FileText } from 'lucide-react';
import type { Ctx } from '../App';
import { daysLeft, money, totals } from '../lib/claim';
import { StatusPill } from './StatusPill';

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
  const todayRoom = t.addedToday > 0 ? c.claim.rooms.find((r) => c.claim.photos.some((p) => p.roomId === r.id && new Date(p.takenAt).toDateString() === new Date().toDateString())) : undefined;
  const due = c.claim.deadline ? new Date(c.claim.deadline + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <main className="screen">
      <header className="top">
        <div className="logo">
          <i aria-hidden />
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
