import { useState } from 'react';
import { ArrowLeft, ArrowRight, CircleCheck, Sparkles } from 'lucide-react';
import type { Ctx } from '../App';
import { findGaps } from '../lib/checkup';
import { nextSteps } from '../lib/ai';
import { s } from '../lib/i18n';

const LEVEL = { urgent: 'Urgent', fix: 'To fix', later: 'Later' } as const;

export function Checkup(c: Ctx) {
  const gaps = findGaps(c.claim);
  const [steps, setSteps] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const canAsk = c.status.device === 'available' || (c.status.online && c.allowCloud);

  async function ask() {
    setBusy(true);
    setErr('');
    try {
      await nextSteps(gaps.map((g) => g.text), c.allowCloud && c.status.online, c.lang, setSteps);
    } catch (e) {
      setErr(s("Couldn't get next steps: {msg}", { msg: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <header className="top">
        <button className="back" onClick={() => c.setView({ name: 'home' })}>
          <ArrowLeft size={18} aria-hidden /> {s('Claim')}
        </button>
      </header>
      <p className="lbl">{s('Claim checkup')}</p>
      <span className="amt">{gaps.length}</span>
      <p className="sub">{gaps.length ? s('Things to look at before you send your claim.') : s('Nothing missing. Your claim looks complete.')}</p>

      {gaps.length > 0 && (
        <section className="steps">
          <div className="sec-h">
            <span>{s('Your next steps')}</span>
            <button className="mini" onClick={ask} disabled={busy || !canAsk}>
              <Sparkles size={14} aria-hidden /> {busy ? s('Thinking…') : steps ? s('Ask again') : s('Ask AI')}
            </button>
          </div>
          {!canAsk && !steps && <p className="muted">{s('Needs signal (with cloud AI on) or on-device AI. The list below works offline.')}</p>}
          {err && <p className="err">{err}</p>}
          {steps && <p className="steps-text">{steps}</p>}
        </section>
      )}

      <section className="card" aria-label={s('Claim checkup')}>
        {gaps.length === 0 && (
          <p className="empty ok-line">
            <CircleCheck size={16} aria-hidden /> {s('All clear')}
          </p>
        )}
        {gaps.map((g, n) => (
          <button key={n} className="gap" onClick={() => c.setView(g.go)}>
            <span className={`st ${g.level === 'urgent' ? 'urg' : g.level === 'fix' ? 'nx' : 'td'}`}>{s(LEVEL[g.level])}</span>
            <span>{g.text}</span>
            <ArrowRight size={15} aria-hidden />
          </button>
        ))}
      </section>
    </main>
  );
}
