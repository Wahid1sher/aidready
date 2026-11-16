import { describe, expect, it } from 'vitest';
import { cleanItems, cleanReceipt, fillLetter, packetFacts } from './ai';
import { newClaim } from './claim';

describe('cleanItems', () => {
  it('drops junk, trims, and turns unknown or absurd estimates into null', () => {
    const out = cleanItems([
      { name: '  Sofa ', damage: 'Wet', estimate: 899.6 },
      { name: '', damage: 'x', estimate: 10 },
      { name: 'TV', damage: 'Cracked', estimate: 0 },
      { name: 'Car', damage: 'Flooded', estimate: 5_000_000 },
      null,
    ]);
    expect(out).toEqual([
      { name: 'Sofa', damage: 'Wet', estimate: 900 },
      { name: 'TV', damage: 'Cracked', estimate: null },
      { name: 'Car', damage: 'Flooded', estimate: null },
    ]);
    expect(cleanItems('nope')).toEqual([]);
  });
});

describe('cleanReceipt', () => {
  it('keeps real dates only and rounds sane amounts', () => {
    expect(cleanReceipt({ what: ' Motel 6 ', amount: 89.99, date: '2026-11-10' })).toEqual({ what: 'Motel 6', amount: 90, date: '2026-11-10' });
    expect(cleanReceipt({ what: 'x', amount: 0, date: '2026-02-30' })).toEqual({ what: 'x', amount: null, date: '' });
    expect(cleanReceipt({ what: 'x', amount: 5, date: 'Nov 10' }).date).toBe('');
    expect(cleanReceipt(null)).toEqual({ what: '', amount: null, date: '' });
  });
});

describe('fillLetter', () => {
  it('fills given details and keeps placeholders for missing ones', () => {
    const t = 'Dear [Insurer],\n[Your name]\n[Address]\nRef: [Claim or registration number]\n[Your name]';
    expect(fillLetter(t, { name: 'Sam Lee', address: '', ref: 'FL-123', insurer: 'Acme Mutual' })).toBe('Dear Acme Mutual,\nSam Lee\n[Address]\nRef: FL-123\nSam Lee');
    expect(fillLetter(t, { name: '', address: '', ref: '' })).toBe(t);
  });
});

describe('packetFacts', () => {
  it('uses only numbers from the claim', () => {
    const c = newClaim();
    c.items = [{ id: 'a', roomId: c.rooms[1].id, photoId: '', name: 'Fridge', damage: '', estimate: 1450, estimateBy: 'you', where: 'on-device' }];
    expect(packetFacts(c)).toContain('Total documented damage: $1,450 across 1 items');
    expect(packetFacts(c)).toContain('Kitchen: 1 items, $1,450');
  });
});
