import { useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, FileText, PencilLine, Receipt, WifiOff } from 'lucide-react';
import type { Lang } from '../lib/i18n';
import { s } from '../lib/i18n';
import { Logo } from './Logo';

const STEPS = [
  {
    icon: Camera,
    title: 'Scan each room',
    body: 'Take a photo of every wall. The AI lists the damaged items it sees and suggests a replacement price for each.',
    demo: ['Fabric sofa · water line', '$800'],
  },
  {
    icon: PencilLine,
    title: 'Check every item',
    body: 'Fix names, change prices, or add things the camera missed. Prices are estimates to help you, not appraisals.',
    demo: ['Fridge · submerged', '$1,450'],
  },
  {
    icon: WifiOff,
    title: 'Works with no signal',
    body: 'Photos are saved on your phone. Gemini Nano can read them right on the device; if it can’t, they wait until you have signal.',
    demo: ['Offline · 12 saved', '●'],
  },
  {
    icon: Receipt,
    title: 'Add extra costs',
    body: 'Hotel, cleanup supplies, meals. Scan a receipt and the amount and date fill in for you. Many programs pay these back.',
    demo: ['Home Depot · cleanup', '$150'],
  },
  {
    icon: FileText,
    title: 'Send your claim packet',
    body: 'The checkup shows what’s missing. Then get a cover letter, an itemised inventory with photos, a PDF and a spreadsheet.',
    demo: ['Total claimed', '$14,590'],
  },
];

/** First-run screen: what the app does, then a step-by-step tour. Skippable at every step. */
export function Welcome({ lang, changeLang, onDone }: { lang: Lang; changeLang: (l: Lang) => void; onDone: () => void }) {
  const [step, setStep] = useState(-1); // -1 = intro
  const st = STEPS[step];

  const top = (
    <header className="top">
      <div className="logo">
        <Logo />
        AidReady
      </div>
      <div className="top-r">
        <div className="lang" role="group" aria-label={s('Language')}>
          {(['en', 'es'] as const).map((l) => (
            <button key={l} aria-pressed={lang === l} onClick={() => changeLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button className="skip" onClick={onDone}>
          {s('Skip')}
        </button>
      </div>
    </header>
  );

  if (!st)
    return (
      <main className="screen welcome">
        {top}
        <div className="wl-hero">
          <Logo size={64} />
          <h1>{s('Your home was damaged. Let’s get your claim ready.')}</h1>
          <p>{s('AidReady turns photos of your home into an itemised damage claim for disaster aid or insurance: every item, a price, photos and a cover letter.')}</p>
          <ul className="wl-points">
            <li>{s('Works with no signal')}</li>
            <li>{s('Photos stay on your phone')}</li>
            <li>{s('Free, in English and Spanish')}</li>
          </ul>
        </div>
        <div className="wl-actions">
          <button className="cta" onClick={() => setStep(0)}>
            {s('Show me how')} <ArrowRight size={18} aria-hidden />
          </button>
          <button className="ghost" onClick={onDone}>
            {s('Skip, start my claim')}
          </button>
        </div>
      </main>
    );

  const Icon = st.icon;
  const last = step === STEPS.length - 1;
  return (
    <main className="screen welcome">
      {top}
      <p className="wl-count mono">{s('Step {n} of {total}', { n: step + 1, total: STEPS.length })}</p>
      <div className="wl-dots" aria-hidden>
        {STEPS.map((_, i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <section className="wl-step" key={step} aria-live="polite">
        <div className="wl-ic">
          <Icon size={30} aria-hidden />
        </div>
        <h2>{s(st.title)}</h2>
        <p>{s(st.body)}</p>
        <div className="wl-demo" aria-hidden>
          <span>{s(st.demo[0])}</span>
          <b className="mono">{st.demo[1]}</b>
        </div>
      </section>
      <div className="wl-actions row">
        <button className="ghost" onClick={() => setStep(step - 1)}>
          <ArrowLeft size={18} aria-hidden /> {s('Back')}
        </button>
        <button className="cta" onClick={() => (last ? onDone() : setStep(step + 1))}>
          {last ? s('Start my claim') : s('Continue')} {!last && <ArrowRight size={18} aria-hidden />}
        </button>
      </div>
    </main>
  );
}
