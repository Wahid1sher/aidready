import { useState } from 'react';
import { ArrowLeft, Plus, ScanLine, Trash2 } from 'lucide-react';
import type { Ctx } from '../App';
import { deletePhoto, money, putPhoto, uid, type Expense } from '../lib/claim';
import { scanReceipt, shrink } from '../lib/ai';
import { s } from '../lib/i18n';
import { Thumb } from './Thumb';

const QUICK = ['Hotel or rental', 'Cleanup supplies', 'Meals', 'Emergency repairs', 'Travel', 'Medical'];

export function Costs(c: Ctx) {
  const list = c.claim.expenses;
  const sum = list.reduce((t, e) => t + (e.amount ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const [reading, setReading] = useState(0);
  const [err, setErr] = useState('');
  const add = (what = '') => c.setClaim((x) => ({ ...x, expenses: [...x.expenses, { id: uid(), what, amount: null, date: today }] }));
  const edit = (id: string, patch: Partial<Expense>) => c.setClaim((x) => ({ ...x, expenses: x.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const remove = (e: Expense) => {
    if (e.receipt) deletePhoto(e.receipt).catch(() => {});
    c.setClaim((x) => ({ ...x, expenses: x.expenses.filter((y) => y.id !== e.id) }));
  };

  /** Each receipt photo is saved first, then read; if reading fails, the cost stays with its photo to fill by hand. */
  async function onReceipts(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? []);
    ev.target.value = '';
    setErr('');
    for (const f of files) {
      setReading((n) => n + 1);
      const id = uid();
      const receipt = uid();
      try {
        const photo = await shrink(f, 1600);
        await putPhoto(receipt, photo);
        c.setClaim((x) => ({ ...x, expenses: [...x.expenses, { id, what: '', amount: null, date: '', receipt }] }));
        if (!c.canRead) continue;
        const r = await scanReceipt(photo, c.allowCloud && c.status.online, c.lang);
        edit(id, { what: r.what, amount: r.amount, date: r.date });
      } catch (e) {
        setErr(s("Couldn't read a receipt: {msg}. The photo is saved; fill it in by hand.", { msg: (e as Error).message }));
      } finally {
        setReading((n) => n - 1);
      }
    }
  }

  return (
    <main className="screen">
      <header className="top">
        <button className="back" onClick={() => c.setView({ name: 'home' })}>
          <ArrowLeft size={18} aria-hidden /> {s('Claim')}
        </button>
      </header>
      <p className="lbl">{s('Extra costs')}</p>
      <span className="amt">
        {money(sum)}
        <span>.00</span>
      </span>
      <p className="sub">{s('Money you spent because of the disaster. Aid programs and insurers often pay some of it back. Keep the receipts.')}</p>

      <label className="cta scan-receipt">
        <ScanLine size={18} aria-hidden /> {reading ? s('Reading receipt…') : s('Scan a receipt')}
        <input type="file" accept="image/*" multiple onChange={onReceipts} hidden />
      </label>
      {!c.canRead && <p className="tip">{s('No AI available right now: receipts are saved and you can fill them in by hand.')}</p>}
      {err && <p className="err">{err}</p>}

      <div className="chips">
        {QUICK.map((q) => (
          <button key={q} className="chip" onClick={() => add(s(q))}>
            <Plus size={13} aria-hidden /> {s(q)}
          </button>
        ))}
      </div>

      <section className="card items" aria-label={s('Extra costs')}>
        {list.length === 0 && <p className="empty">{s('Nothing added yet. Scan a receipt, tap a cost above, or add your own.')}</p>}
        {list.map((e) => (
          <div key={e.id} className={`item ${e.receipt ? 'has-receipt' : ''}`}>
            {e.receipt && (
              <span className="receipt">
                <Thumb id={e.receipt} alt={s('Receipt')} />
              </span>
            )}
            <div className="item-main">
              <input className="in-name" value={e.what} placeholder={s('What it was for')} aria-label={s('What it was for')} onChange={(v) => edit(e.id, { what: v.target.value })} />
              <input className="in-dmg" type="date" value={e.date} aria-label={s('Date')} onChange={(v) => edit(e.id, { date: v.target.value })} />
            </div>
            <label className="est">
              <span>$</span>
              <input
                inputMode="numeric"
                value={e.amount ?? ''}
                placeholder="—"
                aria-label={s('Amount for {what}', { what: e.what || s('cost') })}
                onChange={(v) => {
                  const n = v.target.value.replace(/\D/g, '');
                  edit(e.id, { amount: n ? Number(n) : null });
                }}
              />
            </label>
            <button className="icon" aria-label={s('Remove {what}', { what: e.what || s('cost') })} onClick={() => remove(e)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button className="add" onClick={() => add()}>
          <Plus size={15} aria-hidden /> {s('Add a cost')}
        </button>
      </section>
    </main>
  );
}
