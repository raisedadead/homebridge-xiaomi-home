import { API } from 'homebridge';
import { PLATFORM_NAME } from './settings';
import { XiaomiHomePlatform } from './platform';

export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, XiaomiHomePlatform);
};
