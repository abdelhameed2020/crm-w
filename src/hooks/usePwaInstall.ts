import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const checkIsStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      return isStandaloneMedia || isNavigatorStandalone;
    };

    setIsInstalled(checkIsStandalone());

    // Listen for display-mode changes (e.g. if opened in PWA window)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    // 2. Detect iOS / iPadOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isAppleDevice);

    // 3. Listen for Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 4. Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstructions(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'instructions_opened'> => {
    // If native prompt is available (Android / Chrome / Edge)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          return 'accepted';
        }
        return 'dismissed';
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
        setShowInstructions(true);
        return 'instructions_opened';
      }
    }

    // On iOS or browsers without native prompt support, show helpful visual guide
    setShowInstructions(true);
    return 'instructions_opened';
  }, [deferredPrompt]);

  return {
    isInstalled,
    isInstallable: !isInstalled && (Boolean(deferredPrompt) || isIOS || true),
    isPromptReady: Boolean(deferredPrompt),
    isIOS,
    showInstructions,
    setShowInstructions,
    triggerInstall,
  };
}
