import { useState } from 'react';
import type { Ctx } from '../App';

/** Signal and AI state in one pill; tapping it opens where-the-AI-runs settings. */
export function StatusPill(c: Ctx) {
  const [open, setOpen] = useState(false);
  const [dl, setDl] = useState<number | null>(null);
  const saved = c.claim.photos.length;
  const nano = c.status.device;
  const label = !c.status.online ? `Offline · ${saved} saved` : nano === 'available' ? 'On-device AI' : 'Online';
  const dot = !c.status.online ? 'amber' : nano === 'available' ? 'green' : 'blue';

  return (
    <div className="pill-wrap">
      <button className="off" onClick={() => setOpen(!open)} aria-expanded={open}>
        <b className={dot} />
        {label}
      </button>
      {open && (
        <div className="pop" role="dialog" aria-label="Where photos are read">
          <p className="pop-h">Where your photos are read</p>
          <p>
            Gemini Nano: <strong>{nano === 'available' ? 'ready on this device' : nano === 'downloadable' ? 'can be downloaded' : nano === 'downloading' ? 'downloading' : nano === 'stalled' ? 'not responding' : 'not available in this browser'}</strong>
          </p>
          {nano === 'downloadable' && (
            <button
              className="mini"
              onClick={() => c.enableNano((p) => setDl(Math.round(p * 100))).catch(() => setDl(null))}
            >
              {dl === null ? 'Download on-device AI' : `Downloading ${dl}%`}
            </button>
          )}
          <label className="chk">
            <input type="checkbox" checked={c.allowCloud} onChange={(e) => c.setAllowCloud(e.target.checked)} />
            Use cloud AI when on-device AI isn't available
          </label>
          <p className="muted">With this off, photos never leave this device. Without on-device AI they wait here until you turn it on.</p>
        </div>
      )}
    </div>
  );
}
