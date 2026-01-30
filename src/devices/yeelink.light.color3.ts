import { YeelightColorDevice } from './yeelight-color';
import { LoggerType } from '../types';

export class YeelinkLightColor3 extends YeelightColorDevice {
  readonly model = 'yeelink.light.color3';
  readonly name = 'Yeelight Color Bulb 3';

  constructor(ip: string, token: string, log: LoggerType) {
    super(ip, token, log);
  }
}
