import miio, { Device } from 'miio';
import { DeviceState, DeviceCapabilities, LoggerType } from '../types';

export abstract class BaseDevice {
  abstract readonly model: string;
  abstract readonly name: string;
  abstract readonly capabilities: DeviceCapabilities;
  abstract readonly colorTempRange: { min: number; max: number };

  protected device: Device | null = null;
  protected connected = false;
  protected connecting: Promise<void> | null = null;
  private shuttingDown = false;
  public cachedState: DeviceState = {
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

    // Prevent race condition: if already connecting, wait for that to complete
    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.doConnect();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async doConnect(): Promise<void> {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error(`Connection to ${this.ip} timed out`)), 10000);
    });
    timeout.catch(() => {});
    try {
      this.device = (await Promise.race([
        miio.device({ address: this.ip, token: this.token }),
        timeout,
      ])) as Device;
      this.connected = true;
      this.log.info(`Connected to ${this.name} at ${this.ip}`);
    } catch (error) {
      this.connected = false;
      this.device = null;
      this.log.error(`Failed to connect to ${this.name} at ${this.ip}:`, error);
      throw error;
    } finally {
      clearTimeout(timerId);
    }
  }

  disconnect(): void {
    this.shuttingDown = true;
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

  protected async call(method: string, params: (string | number)[]): Promise<unknown> {
    if (this.shuttingDown) {
      throw new Error('Device is shutting down');
    }

    if (!this.connected || !this.device) {
      await this.connect();
    }

    if (!this.device) {
      throw new Error('Device not connected after connect attempt');
    }

    try {
      return await this.device.call(method, params);
    } catch (error) {
      this.connected = false;
      this.device?.destroy();
      this.device = null;
      throw error;
    }
  }

  abstract getState(): Promise<DeviceState>;
  abstract setPower(on: boolean): Promise<void>;
  abstract setBrightness(level: number): Promise<void>;
  abstract setColorTemperature(kelvin: number): Promise<void>;
  abstract setHue(hue: number): Promise<void>;
  abstract setSaturation(saturation: number): Promise<void>;
}
