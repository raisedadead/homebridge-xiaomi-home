import { Service, PlatformAccessory, CharacteristicValue, Characteristic } from 'homebridge';
import { XiaomiHomePlatform } from '../platform';
import { BaseDevice } from '../devices';

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
        .setCharacteristic(this.Characteristic.SerialNumber, accessory.context.config.ip);
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
    const configInterval = this.platform.config.pollingInterval;
    const baseInterval = Math.max(5, Math.min(60, configInterval || 15)) * 1000;

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

    // Start first poll
    this.pollingInterval = setTimeout(() => poll(), baseInterval);
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

  // Handlers with error handling
  async getOn(): Promise<CharacteristicValue> {
    try {
      const state = await this.device.getState();
      return state.power;
    } catch (error) {
      this.platform.log.error('Failed to get power state:', error);
      return this.device.cachedState.power;
    }
  }

  async setOn(value: CharacteristicValue): Promise<void> {
    try {
      await this.device.setPower(value as boolean);
      this.resetBackoff();
    } catch (error) {
      this.platform.log.error('Failed to set power:', error);
      throw error;
    }
  }

  async getBrightness(): Promise<CharacteristicValue> {
    try {
      const state = await this.device.getState();
      return state.brightness;
    } catch (error) {
      this.platform.log.error('Failed to get brightness:', error);
      return this.device.cachedState.brightness;
    }
  }

  async setBrightness(value: CharacteristicValue): Promise<void> {
    try {
      await this.device.setBrightness(value as number);
    } catch (error) {
      this.platform.log.error('Failed to set brightness:', error);
      throw error;
    }
  }

  async getColorTemperature(): Promise<CharacteristicValue> {
    try {
      const state = await this.device.getState();
      return this.clampMired(this.kelvinToMired(state.colorTemp));
    } catch (error) {
      this.platform.log.error('Failed to get color temperature:', error);
      return this.clampMired(this.kelvinToMired(this.device.cachedState.colorTemp));
    }
  }

  async setColorTemperature(value: CharacteristicValue): Promise<void> {
    try {
      const kelvin = this.miredToKelvin(value as number);
      await this.device.setColorTemperature(kelvin);
    } catch (error) {
      this.platform.log.error('Failed to set color temperature:', error);
      throw error;
    }
  }

  async getHue(): Promise<CharacteristicValue> {
    try {
      const state = await this.device.getState();
      return state.hue;
    } catch (error) {
      this.platform.log.error('Failed to get hue:', error);
      return this.device.cachedState.hue;
    }
  }

  async setHue(value: CharacteristicValue): Promise<void> {
    try {
      await this.device.setHue(value as number);
    } catch (error) {
      this.platform.log.error('Failed to set hue:', error);
      throw error;
    }
  }

  async getSaturation(): Promise<CharacteristicValue> {
    try {
      const state = await this.device.getState();
      return state.saturation;
    } catch (error) {
      this.platform.log.error('Failed to get saturation:', error);
      return this.device.cachedState.saturation;
    }
  }

  async setSaturation(value: CharacteristicValue): Promise<void> {
    try {
      await this.device.setSaturation(value as number);
    } catch (error) {
      this.platform.log.error('Failed to set saturation:', error);
      throw error;
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
