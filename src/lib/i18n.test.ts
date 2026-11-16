import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ES } from './es';
import { CHECKLIST } from './claim';
import { s, setLang } from './i18n';

function sourceKeys(dir: string, out = new Set<string>()) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) sourceKeys(p, out);
    else if (/\.tsx?$/.test(f) && !f.includes('.test.')) {
      for (const m of readFileSync(p, 'utf8').matchAll(/\bs\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) out.add(m[2].replace(/\\'/g, "'"));
    }
  }
  return out;
}

describe('Spanish', () => {
  it('has a translation for every string on screen, with the same {slots}', () => {
    const keys = [...sourceKeys('src'), ...CHECKLIST.map((c) => c.text)];
    const missing = keys.filter((k) => !ES[k]);
    expect(missing).toEqual([]);
    for (const k of keys) expect((ES[k].match(/\{\w+\}/g) ?? []).sort()).toEqual((k.match(/\{\w+\}/g) ?? []).sort());
  });
  it('switches language and fills slots', () => {
    setLang('es');
    expect(s('Scan {room}', { room: 'cocina' })).toBe('Escanear cocina');
    expect(s('Not in the table')).toBe('Not in the table');
    setLang('en');
    expect(s('{n} costs · {sum}', { n: 2, sum: '$5' })).toBe('2 costs · $5');
  });
});
