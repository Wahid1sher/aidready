import { describe, expect, it } from 'vitest';
import { cleanItems, packetFacts } from './ai';
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

describe('packetFacts', () => {
  it('uses only numbers from the claim', () => {
    const c = newClaim();
    c.items = [{ id: 'a', roomId: c.rooms[1].id, photoId: '', name: 'Fridge', damage: '', estimate: 1450, estimateBy: 'you', where: 'on-device' }];
    expect(packetFacts(c)).toContain('Total documented damage: $1,450 across 1 items');
    expect(packetFacts(c)).toContain('Kitchen: 1 items, $1,450');
  });
});
