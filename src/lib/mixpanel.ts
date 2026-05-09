import mixpanel from 'mixpanel-browser/dist/mixpanel.cjs.js';

const MIXPANEL_TOKEN = '0c529cf46049b7f3f6ec202d9da26d13';

export const initMixpanel = () => {
  // Clear any existing stale locks if possible (optional but helpful)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('__mprec_mixpanel')) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {}

  mixpanel.init(MIXPANEL_TOKEN, {
    debug: import.meta.env.DEV,
    track_pageview: true,
    persistence: 'localStorage',
    // Reducimos el porcentaje para evitar saturación mientras debugueamos el mutex
    record_sessions_percent: 50,
    record_mask_all_text: true,
    record_mask_all_inputs: true,
    record_network: true,
    api_host: 'https://api-eu.mixpanel.com',
    // Optimizamos el envío por lotes para no bloquear el hilo principal
    batch_requests: true,
    batch_size: 20,
    batch_flush_interval_ms: 2000,
    // Desactivamos autocapture temporalmente ya que genera demasiados eventos en SPAs
    autocapture: false
  });
};

export const mixpanelTrack = (eventName: string, props?: Record<string, any>) => {
  mixpanel.track(eventName, props);
};

export const mixpanelIdentify = (userId: string) => {
  mixpanel.identify(userId);
};

export const mixpanelPeopleSet = (props: Record<string, any>) => {
  mixpanel.people.set(props);
};

export const mixpanelReset = () => {
  mixpanel.reset();
};

export default mixpanel;
