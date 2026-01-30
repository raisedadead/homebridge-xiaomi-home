import { BaseDevice } from './base';
import { DeviceState, DeviceCapabilities, LoggerType } from '../types';

/**
 * Base class for Yeelight color devices (bulbs, lamps) that share
 * the same miio protocol commands and capabilities.
 */
export abstract class YeelightColorDevice extends BaseDevice {
  abstract readonly model: string;
  abstract readonly name: string;

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
      const props = (await this.call('get_prop', [
        'power',
        'bright',
        'ct',
        'rgb',
        'hue',
        'sat',
        'color_mode',
      ])) as string[];

      // Validate response
      if (!Array.isArray(props) || props.length < 7) {
        this.log.warn('Invalid response from device, using cached state');
        return this.cachedState;
      }

      // Parse with fallback to cached values on NaN
      const brightness = parseInt(props[1], 10);
      const colorTemp = parseInt(props[2], 10);
      const hue = parseInt(props[4], 10);
      const saturation = parseInt(props[5], 10);

      this.cachedState = {
        power: props[0] === 'on',
        brightness: isNaN(brightness) ? this.cachedState.brightness : brightness,
        colorTemp: isNaN(colorTemp) ? this.cachedState.colorTemp : colorTemp,
        hue: isNaN(hue) ? this.cachedState.hue : hue,
        saturation: isNaN(saturation) ? this.cachedState.saturation : saturation,
        colorMode: String(props[6]) === '1' ? 'ct' : String(props[6]) === '2' ? 'rgb' : 'hsv',
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
    const clamped = Math.max(0, Math.min(360, hue));
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
