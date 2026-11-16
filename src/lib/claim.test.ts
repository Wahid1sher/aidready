import { describe, expect, it } from 'vitest';
import { daysLeft, newClaim, toCSV, totals, type Claim } from './claim';

function claimWith(): Claim {
  const c = newClaim();
  const [living, kitchen] = c.rooms;
  living.done = true;
  c.photos = [
    { id: 'p1', roomId: living.id, takenAt: Date.now(), scanned: true },
    { id: 'p2', roomId: kitchen.id, takenAt: Date.now() - 3 * 86_400_000, scanned: true },
    { id: 'p3', roomId: kitchen.id, takenAt: Date.now(), scanned: false },
  ];
  c.items = [
    { id: 'i1', roomId: living.id, photoId: 'p1', name: 'Sofa', damage: 'Water line', estimate: 1200, estimateBy: 'ai', where: 'on-device' },
    { id: 'i2', roomId: kitchen.id, photoId: 'p2', name: 'Fridge', damage: 'Submerged', estimate: 1450, estimateBy: 'you', where: 'on-device' },
    { id: 'i3', roomId: kitchen.id, photoId: 'p2', name: 'Chair', damage: 'Warped', estimate: null, estimateBy: null, where: 'cloud' },
  ];
  return c;
}

describe('totals', () => {
  const t = totals(claimWith());
  it('adds up estimates by room and overall', () => {
    expect(t.total).toBe(2650);
    expect(t.rooms[0].sum).toBe(1200);
    expect(t.rooms[1].sum).toBe(1450);
    expect(t.unestimated).toBe(1);
  });
  it('counts today, done rooms and photos waiting to be read', () => {
    expect(t.addedToday).toBe(1200);
    expect(t.roomsDone).toBe(1);
    expect(t.waiting).toBe(1);
  });
  it('picks the started room as next, else the first untouched one', () => {
    expect(t.next?.name).toBe('Kitchen');
    expect(t.rooms[1].status).toBe('next');
    const fresh = totals(newClaim());
    expect(fresh.next?.name).toBe('Living room');
  });
});

describe('toCSV', () => {
  it('quotes cells, escapes quotes, and defuses spreadsheet formulas', () => {
    const c = claimWith();
    c.items[0].name = 'Sofa, "blue"';
    c.items[1].name = '=HYPERLINK("x")';
    c.expenses = [{ id: 'e', what: 'Hotel', amount: 240, date: '2026-11-10' }];
    const lines = toCSV(c).split('\r\n');
    expect(lines[0]).toBe('"Type","Room","Item","Damage","Estimate (USD)","Date"');
    expect(lines[1]).toBe('"Item","Living room","Sofa, ""blue""","Water line","1200",""');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[4]).toBe('"Expense","","Hotel","","240","2026-11-10"');
  });
  it('counts extra costs in totals', () => {
    const c = claimWith();
    c.expenses = [{ id: 'e', what: 'Hotel', amount: 240, date: '' }, { id: 'f', what: 'Mops', amount: null, date: '' }];
    expect(totals(c).costs).toBe(240);
  });
});

describe('daysLeft', () => {
  const today = new Date(2026, 10, 15);
  it('counts whole days, including today and past deadlines', () => {
    expect(daysLeft('2027-01-08', today)).toBe(54);
    expect(daysLeft('2026-11-15', today)).toBe(0);
    expect(daysLeft('2026-11-14', today)).toBe(-1);
  });
  it('returns null when there is no valid deadline', () => {
    expect(daysLeft('', today)).toBeNull();
    expect(daysLeft('soon', today)).toBeNull();
  });
});
