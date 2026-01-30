import { Service, PlatformAccessory, CharacteristicValue, Characteristic } from 'homebridge';
import { XiaomiHomePlatform } from '../platform';
import { BaseDevice } from '../devices';

export class LightbulbAccessory {
  private service: Service;
  private readonly Characteristic: typeof Characteristic;

  constructor(
    private readonly platform: XiaomiHomePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: BaseDevice,
  ) {
    this.Characteristic = platform.Characteristic;

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
          minValue: this.kelvinToMired(this.device.colorTempRange.max),
          maxValue: this.kelvinToMired(this.device.colorTempRange.min),
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
    const interval = (this.platform.config.pollingInterval || 15) * 1000;

    setInterval(async () => {
      try {
        await this.refreshState();
      } catch (error) {
        this.platform.log.debug('Polling error:', error);
      }
    }, interval);
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
        this.kelvinToMired(state.colorTemp),
      );
    }

    if (this.device.capabilities.color) {
      this.service.updateCharacteristic(this.Characteristic.Hue, state.hue);
      this.service.updateCharacteristic(this.Characteristic.Saturation, state.saturation);
    }
  }

  // Handlers
  async getOn(): Promise<CharacteristicValue> {
    const state = await this.device.getState();
    return state.power;
  }

  async setOn(value: CharacteristicValue): Promise<void> {
    await this.device.setPower(value as boolean);
  }

  async getBrightness(): Promise<CharacteristicValue> {
    const state = await this.device.getState();
    return state.brightness;
  }

  async setBrightness(value: CharacteristicValue): Promise<void> {
    await this.device.setBrightness(value as number);
  }

  async getColorTemperature(): Promise<CharacteristicValue> {
    const state = await this.device.getState();
    return this.kelvinToMired(state.colorTemp);
  }

  async setColorTemperature(value: CharacteristicValue): Promise<void> {
    const kelvin = this.miredToKelvin(value as number);
    await this.device.setColorTemperature(kelvin);
  }

  async getHue(): Promise<CharacteristicValue> {
    const state = await this.device.getState();
    return state.hue;
  }

  async setHue(value: CharacteristicValue): Promise<void> {
    await this.device.setHue(value as number);
  }

  async getSaturation(): Promise<CharacteristicValue> {
    const state = await this.device.getState();
    return state.saturation;
  }

  async setSaturation(value: CharacteristicValue): Promise<void> {
    await this.device.setSaturation(value as number);
  }

  // Conversion utilities
  private kelvinToMired(kelvin: number): number {
    return Math.round(1000000 / kelvin);
  }

  private miredToKelvin(mired: number): number {
    return Math.round(1000000 / mired);
  }
}
