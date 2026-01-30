import { YeelightColorDevice } from './yeelight-color';
import { LoggerType } from '../types';

export class YeelinkLightBslamp2 extends YeelightColorDevice {
  readonly model = 'yeelink.light.bslamp2';
  readonly name = 'Yeelight Bedside Lamp 2';

  constructor(ip: string, token: string, log: LoggerType) {
    super(ip, token, log);
  }
}
