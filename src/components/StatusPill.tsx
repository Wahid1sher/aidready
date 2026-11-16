import { useState } from 'react';
import type { Ctx } from '../App';
import { s } from '../lib/i18n';
import { clearStall } from '../services/hybridAi';

/** Signal and AI state in one pill; tapping it opens where-the-AI-runs settings. */
export function StatusPill(c: Ctx) {
  const [open, setOpen] = useState(false);
  const [dl, setDl] = useState<number | null>(null);
  const saved = c.claim.photos.length;
  const nano = c.status.device;
  const label = !c.status.online ? s('Offline · {n} saved', { n: saved }) : nano === 'available' ? s('On-device AI') : s('Online');
  const dot = !c.status.online ? 'amber' : nano === 'available' ? 'green' : 'blue';

  return (
    <div className="pill-wrap">
      <button className="off" onClick={() => setOpen(!open)} aria-expanded={open}>
        <b className={dot} />
        {label}
      </button>
      {open && (
        <div className="pop" role="dialog" aria-label={s('Where your photos are read')}>
          <p className="pop-h">{s('Where your photos are read')}</p>
          <p>
            Gemini Nano: <strong>{s(nano === 'available' ? 'ready on this device' : nano === 'downloadable' ? 'can be downloaded' : nano === 'downloading' ? 'downloading' : nano === 'stalled' ? 'not responding' : 'not available in this browser')}</strong>
          </p>
          {nano === 'stalled' && (
            <button className="mini" onClick={clearStall}>
              {s('Try again')}
            </button>
          )}
          {nano === 'downloadable' && (
            <button
              className="mini"
              onClick={() => c.enableNano((p) => setDl(Math.round(p * 100))).catch(() => setDl(null))}
            >
              {dl === null ? s('Download on-device AI') : s('Downloading {n}%', { n: dl })}
            </button>
          )}
          <label className="chk">
            <input type="checkbox" checked={c.allowCloud} onChange={(e) => c.setAllowCloud(e.target.checked)} />
            {s("Use cloud AI when on-device AI isn't available")}
          </label>
          <p className="muted">{s('With this off, photos never leave this device. Without on-device AI they wait here until you turn it on.')}</p>
        </div>
      )}
    </div>
  );
}
