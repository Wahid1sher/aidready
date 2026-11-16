import { describe, expect, it } from 'vitest';
import { parseBackup } from './backup';
import { newClaim } from './claim';

const good = () => {
  const claim = newClaim();
  claim.photos = [{ id: 'p1', roomId: claim.rooms[0].id, takenAt: 1, scanned: true }];
  claim.items = [{ id: 'i1', roomId: claim.rooms[0].id, photoId: 'p1', name: 'Sofa', damage: '', estimate: 900, estimateBy: 'ai', where: 'on-device' }];
  return { app: 'aidready', version: 1, savedAt: 1, claim, photos: { p1: 'AAAA' } };
};

describe('parseBackup', () => {
  it('accepts a real backup and fills fields added in newer versions', () => {
    const f = good();
    delete (f.claim as Partial<typeof f.claim>).expenses;
    const b = parseBackup(JSON.stringify(f));
    expect(b.claim.items[0].name).toBe('Sofa');
    expect(b.claim.expenses).toEqual([]);
  });
  it('rejects other files and damaged backups', () => {
    expect(() => parseBackup('hello')).toThrow("isn't an AidReady backup");
    expect(() => parseBackup(JSON.stringify({ ...good(), app: 'other' }))).toThrow("isn't an AidReady backup");
    const bad = good();
    (bad.claim.items[0] as { estimate: unknown }).estimate = '900';
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('damaged');
    expect(() => parseBackup(JSON.stringify({ ...good(), photos: { p1: '<script>' } }))).toThrow('damaged');
  });
});
