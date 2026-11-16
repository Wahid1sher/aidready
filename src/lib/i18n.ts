import { ES } from './es';

/** English and Spanish. Strings are keyed by their English text, so English needs no table. */
export type Lang = 'en' | 'es';

function initial(): Lang {
  try {
    const saved = localStorage.getItem('ar:lang');
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    /* storage blocked */
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('es') ? 'es' : 'en';
}

let lang: Lang = typeof localStorage === 'undefined' ? 'en' : initial();
export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem('ar:lang', l);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
}
export const locale = () => (lang === 'es' ? 'es-US' : 'en-US');

/** Translates `en` (and fills {name} slots from vars). Unknown strings fall back to English. */
export function s(en: string, vars?: Record<string, string | number>): string {
  const out = (lang === 'es' && ES[en]) || en;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}
