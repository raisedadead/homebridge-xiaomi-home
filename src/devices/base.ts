import miio from 'miio';
import { DeviceState, DeviceCapabilities, LoggerType } from '../types';

export abstract class BaseDevice {
  abstract readonly model: string;
  abstract readonly name: string;
  abstract readonly capabilities: DeviceCapabilities;
  abstract readonly colorTempRange: { min: number; max: number };

  protected device: any = null;
  protected connected = false;
  protected cachedState: DeviceState = {
    power: false,
    brightness: 100,
    colorTemp: 4000,
    hue: 0,
    saturation: 0,
    colorMode: 'ct',
  };

  constructor(
    protected readonly ip: string,
    protected readonly token: string,
    protected readonly log: LoggerType,
  ) {}

  async connect(): Promise<void> {
    if (this.connected && this.device) {
      return;
    }

    try {
      this.device = await miio.device({
        address: this.ip,
        token: this.token,
      });
      this.connected = true;
      this.log.info(`Connected to ${this.name} at ${this.ip}`);
    } catch (error) {
      this.connected = false;
      this.log.error(`Failed to connect to ${this.name} at ${this.ip}:`, error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
      this.connected = false;
      this.log.info(`Disconnected from ${this.name}`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  protected async call(method: string, params: any[]): Promise<any> {
    if (!this.connected || !this.device) {
      await this.connect();
    }
    return this.device.call(method, params);
  }

  abstract getState(): Promise<DeviceState>;
  abstract setPower(on: boolean): Promise<void>;
  abstract setBrightness(level: number): Promise<void>;
  abstract setColorTemperature(kelvin: number): Promise<void>;
  abstract setHue(hue: number): Promise<void>;
  abstract setSaturation(saturation: number): Promise<void>;
}
