'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    let hadController = Boolean(navigator.serviceWorker.controller);

    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }

      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void navigator.serviceWorker.register('/sw.js');

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
