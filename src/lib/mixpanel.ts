import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = '0c529cf46049b7f3f6ec202d9da26d13';

export const initMixpanel = () => {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: import.meta.env.DEV,
    track_pageview: true,
    persistence: 'localStorage',
    record_sessions_percent: 100,
    record_mask_all_text: true,
    record_mask_all_inputs: true,
    record_network: true,
    api_host: 'https://api-eu.mixpanel.com',
    autocapture: true
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
