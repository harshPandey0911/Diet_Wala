import { useState, useEffect } from 'react';
import { getCachedSettings, loadBusinessSettings } from '@food/utils/businessSettings';

const readDynamicLogo = (appType) => {
  if (typeof window === 'undefined') return null;

  const storedLogo = localStorage.getItem(`${appType}_logo`);
  if (storedLogo) return storedLogo;

  return getCachedSettings()?.logo?.url || null;
};

/**
 * Hook to get the dynamic app logo for the specific application (user, admin, restaurant, delivery)
 * @param {'user_app' | 'admin_app' | 'restaurant_app' | 'delivery_app'} appType
 * @returns {string | null} The logo URL from business settings if available
 */
export function useAppLogo(appType = 'user_app') {
  const [logo, setLogo] = useState(() => readDynamicLogo(appType));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const syncLogo = async () => {
      const cachedLogo = readDynamicLogo(appType);
      if (cachedLogo) {
        if (!cancelled) setLogo(cachedLogo);
        return;
      }

      const settings = await loadBusinessSettings();
      if (!cancelled) {
        setLogo(settings?.logo?.url || readDynamicLogo(appType));
      }
    };

    void syncLogo();

    const handleLogoUpdate = () => {
      void syncLogo();
    };

    window.addEventListener('themeLoaded', handleLogoUpdate);
    window.addEventListener('businessSettingsUpdated', handleLogoUpdate);
    window.addEventListener('storage', handleLogoUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener('themeLoaded', handleLogoUpdate);
      window.removeEventListener('businessSettingsUpdated', handleLogoUpdate);
      window.removeEventListener('storage', handleLogoUpdate);
    };
  }, [appType]);

  return logo;
}

const readDynamicSubLogo = (appType) => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${appType}_sub_logo`) || null;
};

/**
 * Hook to get the dynamic app sub-logo (only for user_app, displayed under the main logo)
 * @param {'user_app' | 'admin_app' | 'restaurant_app' | 'delivery_app'} appType
 * @returns {string | null} The sub-logo URL if available
 */
export function useAppSubLogo(appType = 'user_app') {
  const [subLogo, setSubLogo] = useState(() => readDynamicSubLogo(appType));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (appType !== 'user_app') return; // Sub-logo is strictly for user_app

    let cancelled = false;

    const syncSubLogo = async () => {
      const cachedSubLogo = readDynamicSubLogo(appType);
      if (cachedSubLogo !== null) {
        if (!cancelled) setSubLogo(cachedSubLogo || null);
        return;
      }

      // If not yet in cache, fetch once from public API
      try {
        const { publicGetOnce } = await import("@food/api");
        const res = await publicGetOnce(`/app-config/${appType}`);
        const data = res?.data?.data || res?.data;
        if (!cancelled && data) {
          if (data.subLogoUrl) {
            localStorage.setItem(`${appType}_sub_logo`, data.subLogoUrl);
            setSubLogo(data.subLogoUrl);
          } else {
            localStorage.removeItem(`${appType}_sub_logo`);
            setSubLogo(null);
          }
        }
      } catch (_) {}
    };

    void syncSubLogo();

    const handleSubLogoUpdate = () => {
      const cached = readDynamicSubLogo(appType);
      setSubLogo(cached || null);
    };

    window.addEventListener('themeLoaded', handleSubLogoUpdate);
    window.addEventListener('storage', handleSubLogoUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener('themeLoaded', handleSubLogoUpdate);
      window.removeEventListener('storage', handleSubLogoUpdate);
    };
  }, [appType]);

  return subLogo;
}
