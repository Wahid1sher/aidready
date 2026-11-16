import { useState } from 'react';
import { ArrowLeft, Download, Printer, Sparkles } from 'lucide-react';
import type { Ctx } from '../App';
import { money, toCSV, totals } from '../lib/claim';
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

  const d = c.claim.details;
  const setD = (k: keyof typeof d, v: string) => c.setClaim((x) => ({ ...x, details: { ...x.details, [k]: v } }));
  // The AI only ever sees placeholders; your details are filled in here, on this device.
  const filled = (s: string) =>
    s.replace(/\[Your name\]/g, d.name || '[Your name]').replace(/\[Address\]/g, d.address || '[Address]').replace(/\[Claim or registration number\]/g, d.ref || '[Claim or registration number]');

  function downloadCSV() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCSV(c.claim)], { type: 'text/csv' }));
    a.download = `aidready-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

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
        <div className="actions">
          <button className="mini" onClick={downloadCSV}>
            <Download size={15} aria-hidden /> CSV
          </button>
          <button className="mini" onClick={() => print()}>
            <Printer size={15} aria-hidden /> Print or PDF
          </button>
        </div>
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
        {(draft || letter) && <div className="print-only letter-print">{filled(draft || letter)}</div>}
      </section>

      <section className="noprint">
        <div className="sec-h">
          <span>Your details</span>
          <span className="muted">Stay on this device</span>
        </div>
        <div className="details">
          <input value={d.name} placeholder="Your name" aria-label="Your name" autoComplete="name" onChange={(e) => setD('name', e.target.value)} />
          <input value={d.address} placeholder="Damaged property address" aria-label="Damaged property address" autoComplete="street-address" onChange={(e) => setD('address', e.target.value)} />
          <input value={d.ref} placeholder="Claim or registration number" aria-label="Claim or registration number" onChange={(e) => setD('ref', e.target.value)} />
        </div>
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
        {c.claim.expenses.length > 0 && (
          <table>
            <caption>
              <span>Extra costs</span>
              <span className="mono">{money(t.costs)}</span>
            </caption>
            <thead>
              <tr>
                <th>Cost</th>
                <th>Date</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {c.claim.expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.what || 'Unnamed cost'}</td>
                  <td>{e.date}</td>
                  <td className="r mono">{e.amount === null ? 'TBD' : money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grand">
          <span>Total claimed</span>
          <span className="mono">{money(t.total + t.costs)}</span>
        </div>
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
