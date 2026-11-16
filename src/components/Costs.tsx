import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type { Ctx } from '../App';
import { money, uid, type Expense } from '../lib/claim';

const QUICK = ['Hotel or rental', 'Cleanup supplies', 'Meals', 'Emergency repairs', 'Travel', 'Medical'];

export function Costs(c: Ctx) {
  const list = c.claim.expenses;
  const sum = list.reduce((s, e) => s + (e.amount ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const add = (what = '') => c.setClaim((x) => ({ ...x, expenses: [...x.expenses, { id: uid(), what, amount: null, date: today }] }));
  const edit = (id: string, patch: Partial<Expense>) => c.setClaim((x) => ({ ...x, expenses: x.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  return (
    <main className="screen">
      <header className="top">
        <button className="back" onClick={() => c.setView({ name: 'home' })}>
          <ArrowLeft size={18} aria-hidden /> Claim
        </button>
      </header>
      <p className="lbl">Extra costs</p>
      <span className="amt">
        {money(sum)}
        <span>.00</span>
      </span>
      <p className="sub">Money you spent because of the disaster. Aid programs and insurers often pay some of it back. Keep the receipts.</p>

      <div className="chips">
        {QUICK.map((q) => (
          <button key={q} className="chip" onClick={() => add(q)}>
            <Plus size={13} aria-hidden /> {q}
          </button>
        ))}
      </div>

      <section className="card items" aria-label="Extra costs">
        {list.length === 0 && <p className="empty">Nothing added yet. Tap a cost above, or add your own.</p>}
        {list.map((e) => (
          <div key={e.id} className="item">
            <div className="item-main">
              <input className="in-name" value={e.what} placeholder="What it was for" aria-label="What it was for" onChange={(v) => edit(e.id, { what: v.target.value })} />
              <input className="in-dmg" type="date" value={e.date} aria-label="Date" onChange={(v) => edit(e.id, { date: v.target.value })} />
            </div>
            <label className="est">
              <span>$</span>
              <input
                inputMode="numeric"
                value={e.amount ?? ''}
                placeholder="—"
                aria-label={`Amount for ${e.what || 'cost'}`}
                onChange={(v) => {
                  const n = v.target.value.replace(/\D/g, '');
                  edit(e.id, { amount: n ? Number(n) : null });
                }}
              />
            </label>
            <button className="icon" aria-label={`Remove ${e.what || 'cost'}`} onClick={() => c.setClaim((x) => ({ ...x, expenses: x.expenses.filter((y) => y.id !== e.id) }))}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button className="add" onClick={() => add()}>
          <Plus size={15} aria-hidden /> Add a cost
        </button>
      </section>
    </main>
  );
}
