import { Service, PlatformAccessory, CharacteristicValue, Characteristic } from 'homebridge';
import { XiaomiHomePlatform } from '../platform';
import { BaseDevice } from '../devices';
import { PLUGIN_VERSION } from '../settings';

export class LightbulbAccessory {
  private service: Service;
  private readonly Characteristic: typeof Characteristic;
  private readonly minMired: number;
  private readonly maxMired: number;
  private pollingInterval: ReturnType<typeof setTimeout> | null = null;
  private pollFailures = 0;
  private readonly maxPollFailures = 5;
  private backoffMs = 0;

  constructor(
    private readonly platform: XiaomiHomePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: BaseDevice,
    private readonly deviceIndex: number = 0,
  ) {
    this.Characteristic = platform.Characteristic;

    // Calculate mired range from device's kelvin range (inverted: high K = low mired)
    this.minMired = Math.max(140, this.kelvinToMired(this.device.colorTempRange.max));
    this.maxMired = Math.min(500, this.kelvinToMired(this.device.colorTempRange.min));

    // Set accessory information
    const accessoryInfo = this.accessory.getService(this.platform.Service.AccessoryInformation);
    if (accessoryInfo) {
      accessoryInfo
        .setCharacteristic(this.Characteristic.Manufacturer, 'Xiaomi')
        .setCharacteristic(this.Characteristic.Model, device.model)
        .setCharacteristic(this.Characteristic.SerialNumber, accessory.context.config.ip)
        .setCharacteristic(this.Characteristic.FirmwareRevision, PLUGIN_VERSION);
    }

    // Get or create Lightbulb service
    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    this.service.setCharacteristic(this.Characteristic.Name, accessory.context.config.name);

    // Register handlers
    this.setupCharacteristics();

    // Start polling
    this.startPolling();
  }

  private setupCharacteristics(): void {
    // On/Off (required)
    this.service
      .getCharacteristic(this.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    // Brightness
    if (this.device.capabilities.brightness) {
      this.service
        .getCharacteristic(this.Characteristic.Brightness)
        .onGet(this.getBrightness.bind(this))
        .onSet(this.setBrightness.bind(this));
    }

    // Color Temperature
    if (this.device.capabilities.colorTemperature) {
      this.service
        .getCharacteristic(this.Characteristic.ColorTemperature)
        .setProps({
          minValue: this.minMired,
          maxValue: this.maxMired,
        })
        .onGet(this.getColorTemperature.bind(this))
        .onSet(this.setColorTemperature.bind(this));
    }

    // Hue and Saturation
    if (this.device.capabilities.color) {
      this.service
        .getCharacteristic(this.Characteristic.Hue)
        .onGet(this.getHue.bind(this))
        .onSet(this.setHue.bind(this));

      this.service
        .getCharacteristic(this.Characteristic.Saturation)
        .onGet(this.getSaturation.bind(this))
        .onSet(this.setSaturation.bind(this));
    }
  }

  private startPolling(): void {
    const configInterval = Number(this.platform.config.pollingInterval);
    const baseInterval =
      Math.max(5, Math.min(60, isNaN(configInterval) ? 15 : configInterval)) * 1000;

    const poll = async () => {
      try {
        await this.refreshState();
        // Reset backoff on success
        this.pollFailures = 0;
        this.backoffMs = 0;
      } catch (error) {
        this.pollFailures++;
        if (this.pollFailures >= this.maxPollFailures) {
          // Exponential backoff: 30s, 60s, 120s, 240s, max 5min
          this.backoffMs = Math.min(
            300000,
            30000 * Math.pow(2, this.pollFailures - this.maxPollFailures),
          );
          this.platform.log.warn(
            `Device ${this.device.name} offline after ${this.pollFailures} failures. ` +
              `Next retry in ${this.backoffMs / 1000}s`,
          );
        } else {
          this.platform.log.debug('Polling error:', error);
        }
      }

      // Schedule next poll with backoff
      const nextInterval = baseInterval + this.backoffMs;
      this.pollingInterval = setTimeout(() => poll(), nextInterval);
    };

    // Stagger first poll across devices (2s apart) — but start soon
    const staggerDelay = this.deviceIndex * 2000;
    this.pollingInterval = setTimeout(() => poll(), staggerDelay);
  }

  public stopPolling(): void {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  public resetBackoff(): void {
    this.pollFailures = 0;
    this.backoffMs = 0;
  }

  async refreshState(): Promise<void> {
    const state = await this.device.getState();

    this.service.updateCharacteristic(this.Characteristic.On, state.power);

    if (this.device.capabilities.brightness) {
      this.service.updateCharacteristic(this.Characteristic.Brightness, state.brightness);
    }

    if (this.device.capabilities.colorTemperature) {
      this.service.updateCharacteristic(
        this.Characteristic.ColorTemperature,
        this.clampMired(this.kelvinToMired(state.colorTemp)),
      );
    }

    if (this.device.capabilities.color) {
      this.service.updateCharacteristic(this.Characteristic.Hue, state.hue);
      this.service.updateCharacteristic(this.Characteristic.Saturation, state.saturation);
    }
  }

  async getOn(): Promise<CharacteristicValue> {
    return this.device.cachedState.power;
  }

  async setOn(value: CharacteristicValue): Promise<void> {
    const power = value === true || value === 1;
    try {
      await this.device.setPower(power);
      this.resetBackoff();
    } catch (error) {
      this.platform.log.error('Failed to set power:', error);
      throw new this.platform.api.hap.HapStatusError(-70402);
    }
  }

  async getBrightness(): Promise<CharacteristicValue> {
    return this.device.cachedState.brightness;
  }

  async setBrightness(value: CharacteristicValue): Promise<void> {
    const level = Number(value);
    if (isNaN(level)) {
      throw new this.platform.api.hap.HapStatusError(-70410);
    }
    try {
      await this.device.setBrightness(level);
    } catch (error) {
      this.platform.log.error('Failed to set brightness:', error);
      throw new this.platform.api.hap.HapStatusError(-70402);
    }
  }

  async getColorTemperature(): Promise<CharacteristicValue> {
    return this.clampMired(this.kelvinToMired(this.device.cachedState.colorTemp));
  }

  async setColorTemperature(value: CharacteristicValue): Promise<void> {
    const mired = Number(value);
    if (isNaN(mired)) {
      throw new this.platform.api.hap.HapStatusError(-70410);
    }
    try {
      const kelvin = this.miredToKelvin(mired);
      await this.device.setColorTemperature(kelvin);
    } catch (error) {
      this.platform.log.error('Failed to set color temperature:', error);
      throw new this.platform.api.hap.HapStatusError(-70402);
    }
  }

  async getHue(): Promise<CharacteristicValue> {
    return this.device.cachedState.hue;
  }

  async setHue(value: CharacteristicValue): Promise<void> {
    const hue = Number(value);
    if (isNaN(hue)) {
      throw new this.platform.api.hap.HapStatusError(-70410);
    }
    try {
      await this.device.setHue(hue);
    } catch (error) {
      this.platform.log.error('Failed to set hue:', error);
      throw new this.platform.api.hap.HapStatusError(-70402);
    }
  }

  async getSaturation(): Promise<CharacteristicValue> {
    return this.device.cachedState.saturation;
  }

  async setSaturation(value: CharacteristicValue): Promise<void> {
    const sat = Number(value);
    if (isNaN(sat)) {
      throw new this.platform.api.hap.HapStatusError(-70410);
    }
    try {
      await this.device.setSaturation(sat);
    } catch (error) {
      this.platform.log.error('Failed to set saturation:', error);
      throw new this.platform.api.hap.HapStatusError(-70402);
    }
  }

  // Conversion utilities
  private kelvinToMired(kelvin: number): number {
    if (kelvin <= 0) return this.maxMired || 500;
    return Math.round(1000000 / kelvin);
  }

  private miredToKelvin(mired: number): number {
    if (mired <= 0) return 2000;
    return Math.round(1000000 / mired);
  }

  private clampMired(mired: number): number {
    return Math.max(this.minMired, Math.min(this.maxMired, mired));
  }
}
