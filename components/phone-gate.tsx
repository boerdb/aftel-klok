'use client';

import { useEffect, useState } from 'react';
import { isPhoneDevice } from '@/lib/pwa';

export function PhoneGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isPhoneDevice());
  }, []);

  if (!show) return null;

  return (
    <div className="phone-gate" role="dialog" aria-modal="true" aria-labelledby="phone-gate-title">
      <div className="phone-gate-card">
        <div className="phone-gate-icon" aria-hidden>
          ▦
        </div>
        <h2 id="phone-gate-title">Alleen op een tablet</h2>
        <p>Deze app werkt alleen op een tablet in landscape — niet op een telefoon.</p>
        <p className="phone-gate-url">
          Open op je tablet:
          <br />
          <strong>https://timer.clvs.nl</strong>
        </p>
      </div>
    </div>
  );
}
