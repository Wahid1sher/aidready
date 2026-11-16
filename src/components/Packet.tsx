import { useState } from 'react';
import { ArrowLeft, Printer, Sparkles } from 'lucide-react';
import type { Ctx } from '../App';
import { money, totals } from '../lib/claim';
import { draftLetter } from '../lib/ai';
import { Thumb } from './Thumb';

export function Packet(c: Ctx) {
  const t = totals(c.claim);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const letter = c.claim.packet?.text ?? '';
  const cloudOk = c.allowCloud && c.status.online;
  const canWrite = cloudOk || c.status.device === 'available';

  async function write() {
    setBusy(true);
    setErr('');
    try {
      const r = await draftLetter(c.claim, cloudOk, setDraft);
      c.setClaim((x) => ({ ...x, packet: { text: r.data.trim(), at: Date.now(), where: r.where } }));
    } catch (e) {
      setErr(`Couldn't write the letter: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setDraft('');
    }
  }

  return (
    <main className="screen packet">
      <header className="top noprint">
        <button className="back" onClick={() => c.setView({ name: 'home' })}>
          <ArrowLeft size={18} aria-hidden /> Claim
        </button>
        <button className="mini" onClick={() => print()}>
          <Printer size={15} aria-hidden /> Print or save PDF
        </button>
      </header>

      <h1 className="doc-h">Household damage inventory</h1>
      <p className="sub">
        Prepared {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })} · {t.items} items · {c.claim.photos.length} photos
      </p>

      <section className="letter">
        <div className="sec-h noprint">
          <span>Cover letter</span>
          <button className="mini" onClick={write} disabled={busy || !canWrite}>
            <Sparkles size={14} aria-hidden /> {busy ? 'Writing…' : letter ? 'Rewrite' : 'Write it for me'}
          </button>
        </div>
        {!canWrite && !letter && <p className="muted noprint">Needs signal (with cloud AI on) or on-device AI. Your inventory below is ready either way.</p>}
        {err && <p className="err noprint">{err}</p>}
        {(draft || letter) && (
          <textarea
            className="letter-text"
            value={draft || letter}
            readOnly={busy}
            rows={12}
            aria-label="Cover letter"
            onChange={(e) => c.setClaim((x) => ({ ...x, packet: { ...x.packet!, text: e.target.value } }))}
          />
        )}
        {(draft || letter) && <div className="print-only letter-print">{draft || letter}</div>}
      </section>

      <section className="inv">
        <div className="sec-h">
          <span>Itemised inventory</span>
          <span className="mono">{money(t.total)}</span>
        </div>
        {t.rooms
          .filter((r) => r.count > 0)
          .map((r) => (
            <table key={r.room.id}>
              <caption>
                <span>{r.room.name}</span>
                <span className="mono">{money(r.sum)}</span>
              </caption>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Damage</th>
                  <th className="r">Estimate</th>
                </tr>
              </thead>
              <tbody>
                {c.claim.items
                  .filter((i) => i.roomId === r.room.id)
                  .map((i) => (
                    <tr key={i.id}>
                      <td>{i.name || 'Unnamed item'}</td>
                      <td>{i.damage}</td>
                      <td className="r mono">{i.estimate === null ? 'TBD' : money(i.estimate)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ))}
        <p className="note">Estimates are approximate replacement costs, not appraisals. {t.unestimated ? `${t.unestimated} items still need an estimate.` : ''}</p>
      </section>

      <section className="photos">
        <div className="sec-h">
          <span>Photos</span>
        </div>
        <div className="thumbs big">
          {c.claim.photos.map((p, n) => (
            <figure key={p.id}>
              <Thumb id={p.id} alt={`Photo ${n + 1}`} />
              <figcaption>
                {n + 1}. {c.claim.rooms.find((r) => r.id === p.roomId)?.name} · {new Date(p.takenAt).toLocaleDateString()}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
