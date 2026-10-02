'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    // A new version takes over fetches, but an open countdown keeps running.
    // The next launch loads the update when the server is available.
    void navigator.serviceWorker.register('/sw.js');
  }, []);

  return null;
}
