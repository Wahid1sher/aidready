import { useState } from 'react';
import { ArrowLeft, Download, Printer, Sparkles } from 'lucide-react';
import type { Ctx } from '../App';
import { locale, s } from '../lib/i18n';
import { money, toCSV, totals } from '../lib/claim';
import { draftLetter, fillLetter } from '../lib/ai';
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
  // The AI only ever sees placeholders; your details are filled in here, on this device, as you type.
  const shown = fillLetter(draft || letter, d);

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
      const r = await draftLetter(c.claim, cloudOk, c.lang, setDraft);
      c.setClaim((x) => ({ ...x, packet: { text: r.data.trim(), at: Date.now(), where: r.where } }));
    } catch (e) {
      setErr(s("Couldn't write the letter: {msg}", { msg: (e as Error).message }));
    } finally {
      setBusy(false);
      setDraft('');
    }
  }

  return (
    <main className="screen packet">
      <header className="top noprint">
        <button className="back" onClick={() => c.setView({ name: 'home' })}>
          <ArrowLeft size={18} aria-hidden /> {s('Claim')}
        </button>
        <div className="actions">
          <button className="mini" onClick={downloadCSV}>
            <Download size={15} aria-hidden /> CSV
          </button>
          <button className="mini" onClick={() => print()}>
            <Printer size={15} aria-hidden /> {s('Print or PDF')}
          </button>
        </div>
      </header>

      <h1 className="doc-h">{s('Household damage inventory')}</h1>
      <p className="sub">
        {s('Prepared {date} · {n} items · {p} photos', { date: new Date().toLocaleDateString(locale(), { dateStyle: 'long' }), n: t.items, p: c.claim.photos.length })}
      </p>

      <section className="noprint">
        <div className="sec-h">
          <span>{s('Your details')}</span>
          <span className="muted">{s('Stay on this device')}</span>
        </div>
        <div className="details">
          <input value={d.insurer ?? ''} placeholder={s('Insurance company or aid program')} aria-label={s('Insurance company or aid program')} onChange={(e) => setD('insurer', e.target.value)} />
          <input value={d.name} placeholder={s('Your name')} aria-label={s('Your name')} autoComplete="name" onChange={(e) => setD('name', e.target.value)} />
          <input value={d.address} placeholder={s('Damaged property address')} aria-label={s('Damaged property address')} autoComplete="street-address" onChange={(e) => setD('address', e.target.value)} />
          <input value={d.ref} placeholder={s('Claim or registration number')} aria-label={s('Claim or registration number')} onChange={(e) => setD('ref', e.target.value)} />
        </div>
      </section>

      <section className="letter">
        <div className="sec-h noprint">
          <span>{s('Cover letter')}</span>
          <button className="mini" onClick={write} disabled={busy || !canWrite}>
            <Sparkles size={14} aria-hidden /> {busy ? s('Writing…') : letter ? s('Rewrite') : s('Write it for me')}
          </button>
        </div>
        {!canWrite && !letter && <p className="muted noprint">{s('Needs signal (with cloud AI on) or on-device AI. Your inventory below is ready either way.')}</p>}
        {err && <p className="err noprint">{err}</p>}
        {(draft || letter) && (
          <textarea
            className="letter-text"
            value={shown}
            readOnly={busy}
            rows={14}
            aria-label={s('Cover letter')}
            onChange={(e) => c.setClaim((x) => ({ ...x, packet: { ...x.packet!, text: e.target.value } }))}
          />
        )}
        {(draft || letter) && <div className="print-only letter-print">{shown}</div>}
      </section>

      <section className="inv">
        <div className="sec-h">
          <span>{s('Itemised inventory')}</span>
          <span className="mono">{money(t.total)}</span>
        </div>
        {t.rooms
          .filter((r) => r.count > 0)
          .map((r) => (
            <table key={r.room.id}>
              <caption>
                <span>{s(r.room.name)}</span>
                <span className="mono">{money(r.sum)}</span>
              </caption>
              <thead>
                <tr>
                  <th>{s('Item')}</th>
                  <th>{s('Damage')}</th>
                  <th className="r">{s('Estimate')}</th>
                </tr>
              </thead>
              <tbody>
                {c.claim.items
                  .filter((i) => i.roomId === r.room.id)
                  .map((i) => (
                    <tr key={i.id}>
                      <td>{i.name || s('Unnamed item')}</td>
                      <td>{i.damage}</td>
                      <td className="r mono">{i.estimate === null ? s('TBD') : money(i.estimate)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ))}
        {c.claim.expenses.length > 0 && (
          <table>
            <caption>
              <span>{s('Extra costs')}</span>
              <span className="mono">{money(t.costs)}</span>
            </caption>
            <thead>
              <tr>
                <th>{s('Cost')}</th>
                <th>{s('Date')}</th>
                <th className="r">{s('Amount')}</th>
              </tr>
            </thead>
            <tbody>
              {c.claim.expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.what || s('Unnamed cost')}</td>
                  <td>{e.date}</td>
                  <td className="r mono">{e.amount === null ? s('TBD') : money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grand">
          <span>{s('Total claimed')}</span>
          <span className="mono">{money(t.total + t.costs)}</span>
        </div>
        <p className="note">{s('Estimates are approximate replacement costs, not appraisals.')} {t.unestimated ? s('{n} items still need an estimate.', { n: t.unestimated }) : ''}</p>
      </section>

      <section className="photos">
        <div className="sec-h">
          <span>{s('Photos')}</span>
        </div>
        <div className="thumbs big">
          {c.claim.photos.map((p, n) => (
            <figure key={p.id}>
              <Thumb id={p.id} alt={s('Photo {n}', { n: n + 1 })} />
              <figcaption>
                {n + 1}. {s(c.claim.rooms.find((r) => r.id === p.roomId)?.name ?? '')} · {new Date(p.takenAt).toLocaleDateString(locale())}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
