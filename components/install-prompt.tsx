'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const androidDismissKey = 'install-banner-dismissed-android';
const iosDismissKey = 'install-banner-dismissed-ios';

function isDismissed(key: string): boolean {
  return localStorage.getItem(key) === '1';
}

function persistDismiss(key: string): void {
  localStorage.setItem(key, '1');
}

function isStandaloneMode(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function isIos(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const isIosDevice = /iphone|ipad|ipod/.test(ua);
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIosDevice || isIpadOs;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);

  useEffect(() => {
    const update = (prompt: BeforeInstallPromptEvent | null) => {
      const standalone = isStandaloneMode();
      setShowAndroidBanner(
        isAndroid() && !standalone && !isDismissed(androidDismissKey) && prompt !== null,
      );
      setShowIosBanner(isIos() && !standalone && !isDismissed(iosDismissKey));
    };

    update(null);

    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
      update(promptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      persistDismiss(androidDismissKey);
      update(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  async function installOnAndroid(): Promise<void> {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      persistDismiss(androidDismissKey);
    }

    setDeferredPrompt(null);
    setShowAndroidBanner(false);
  }

  if (showAndroidBanner) {
    return (
      <div className="install-banner">
        <div className="install-banner__text">
          Installeer deze app op je Android-startscherm voor snellere toegang.
        </div>
        <div className="install-banner__actions">
          <button type="button" className="install-banner__button" onClick={() => void installOnAndroid()}>
            Installeren
          </button>
          <button
            type="button"
            className="install-banner__button install-banner__button--ghost"
            onClick={() => {
              persistDismiss(androidDismissKey);
              setShowAndroidBanner(false);
            }}
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  if (showIosBanner) {
    return (
      <div className="install-banner install-banner--ios">
        <div className="install-banner__text">
          Voeg deze app toe aan je iPad-startscherm: tik op Delen in Safari en kies Zet op beginscherm.
        </div>
        <div className="install-banner__actions">
          <button
            type="button"
            className="install-banner__button install-banner__button--ghost"
            onClick={() => {
              persistDismiss(iosDismissKey);
              setShowIosBanner(false);
            }}
          >
            Begrepen
          </button>
        </div>
      </div>
    );
  }

  return null;
}
