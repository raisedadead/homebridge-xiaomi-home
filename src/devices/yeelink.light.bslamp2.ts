import { BaseDevice } from './base';
import { DeviceState, DeviceCapabilities, LoggerType } from '../types';

export class YeelinkLightBslamp2 extends BaseDevice {
  readonly model = 'yeelink.light.bslamp2';
  readonly name = 'Yeelight Bedside Lamp 2';
  readonly capabilities: DeviceCapabilities = {
    power: true,
    brightness: true,
    colorTemperature: true,
    color: true,
  };
  readonly colorTempRange = { min: 1700, max: 6500 };

  constructor(ip: string, token: string, log: LoggerType) {
    super(ip, token, log);
  }

  async getState(): Promise<DeviceState> {
    try {
      const props = await this.call('get_prop', [
        'power',
        'bright',
        'ct',
        'rgb',
        'hue',
        'sat',
        'color_mode',
      ]);

      this.cachedState = {
        power: props[0] === 'on',
        brightness: parseInt(props[1], 10),
        colorTemp: parseInt(props[2], 10),
        hue: parseInt(props[4], 10),
        saturation: parseInt(props[5], 10),
        colorMode: props[6] === '1' ? 'ct' : props[6] === '2' ? 'rgb' : 'hsv',
      };

      return this.cachedState;
    } catch (error) {
      this.log.error('Failed to get state:', error);
      return this.cachedState;
    }
  }

  async setPower(on: boolean): Promise<void> {
    await this.call('set_power', [on ? 'on' : 'off', 'smooth', 500]);
    this.cachedState.power = on;
  }

  async setBrightness(level: number): Promise<void> {
    const clamped = Math.max(1, Math.min(100, level));
    await this.call('set_bright', [clamped, 'smooth', 500]);
    this.cachedState.brightness = clamped;
  }

  async setColorTemperature(kelvin: number): Promise<void> {
    const clamped = Math.max(this.colorTempRange.min, Math.min(this.colorTempRange.max, kelvin));
    await this.call('set_ct_abx', [clamped, 'smooth', 500]);
    this.cachedState.colorTemp = clamped;
    this.cachedState.colorMode = 'ct';
  }

  async setHue(hue: number): Promise<void> {
    const clamped = Math.max(0, Math.min(359, hue));
    await this.call('set_hsv', [clamped, this.cachedState.saturation, 'smooth', 500]);
    this.cachedState.hue = clamped;
    this.cachedState.colorMode = 'hsv';
  }

  async setSaturation(saturation: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, saturation));
    await this.call('set_hsv', [this.cachedState.hue, clamped, 'smooth', 500]);
    this.cachedState.saturation = clamped;
    this.cachedState.colorMode = 'hsv';
  }
}
