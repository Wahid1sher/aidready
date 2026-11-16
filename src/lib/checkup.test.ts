import { describe, expect, it } from 'vitest';
import { findGaps } from './checkup';
import { CHECKLIST, newClaim } from './claim';

const today = new Date(2026, 10, 15);

describe('findGaps', () => {
  it('flags a missing deadline first and lists untouched rooms', () => {
    const g = findGaps(newClaim(), today);
    expect(g[0]).toMatchObject({ level: 'urgent', text: expect.stringContaining('No aid deadline') });
    expect(g.some((x) => x.text.startsWith('No photos yet: Living room, Kitchen'))).toBe(true);
  });
  it('warns when the deadline is close, and about items and costs to fix', () => {
    const c = newClaim();
    c.deadline = '2026-11-25';
    c.items = [{ id: 'i', roomId: c.rooms[1].id, photoId: '', name: 'Fridge', damage: '', estimate: null, estimateBy: null, where: 'on-device' }];
    c.expenses = [{ id: 'e', what: 'Hotel', amount: null, date: '' }];
    const texts = findGaps(c, today).map((x) => x.text);
    expect(texts).toContain('Your aid deadline is in 10 days.');
    expect(texts).toContain('Kitchen: 1 items have no estimate.');
    expect(texts).toContain('1 extra costs have no amount.');
    expect(texts).toContain('Not marked done: Kitchen.');
  });
  it('has nothing to say about a finished claim', () => {
    const c = newClaim();
    c.deadline = '2027-03-01';
    c.rooms = c.rooms.map((r) => ({ ...r, done: true }));
    c.details = { name: 'A', address: 'B', ref: 'C', insurer: 'D' };
    c.checks = CHECKLIST.map((x) => x.id);
    expect(findGaps(c, today)).toEqual([]);
  });
});
