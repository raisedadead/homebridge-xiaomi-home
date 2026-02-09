import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { DeviceConfig } from './types';
import { createDevice, BaseDevice, getSupportedModels } from './devices';
import { LightbulbAccessory } from './accessories';

export class XiaomiHomePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly accessories: PlatformAccessory[] = [];

  private readonly devices: Map<string, BaseDevice> = new Map();
  private readonly lightbulbAccessories: LightbulbAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.debug('Initializing platform:', config.name);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Finished launching, discovering devices...');
      this.discoverDevices().catch(error => {
        this.log.error('Failed to discover devices:', error);
      });
    });

    this.api.on('shutdown', () => {
      this.log.info('Shutting down, disconnecting devices...');
      this.disconnectAllDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  private async discoverDevices(): Promise<void> {
    const deviceConfigs: DeviceConfig[] = this.config.devices || [];
    if (deviceConfigs.length === 0) {
      this.log.warn('No devices configured. Add devices to your config.json.');
      return;
    }

    const supportedModels = getSupportedModels();
    const validConfigs = deviceConfigs.filter(d => {
      if (!d.name || !d.ip || !d.token || !d.model) {
        this.log.error('Invalid device config, missing required fields:', d);
        return false;
      }
      if (!supportedModels.includes(d.model)) {
        this.log.error(`Unsupported model: ${d.model}. Supported: ${supportedModels.join(', ')}`);
        return false;
      }
      return true;
    });

    const results = await Promise.allSettled(
      validConfigs.map((config, index) => this.initializeDevice(config, index)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.log.error('Device initialization failed:', result.reason);
      }
    }

    // Remove stale accessories
    const configuredUUIDs = validConfigs.map(d => this.api.hap.uuid.generate(`${d.ip}-${d.model}`));
    const staleAccessories = this.accessories.filter(acc => !configuredUUIDs.includes(acc.UUID));
    if (staleAccessories.length > 0) {
      this.log.info(
        'Removing stale accessories:',
        staleAccessories.map(a => a.displayName),
      );
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }
  }

  private async initializeDevice(deviceConfig: DeviceConfig, index: number): Promise<void> {
    const uuid = this.api.hap.uuid.generate(`${deviceConfig.ip}-${deviceConfig.model}`);
    const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);

    const device = createDevice(deviceConfig.model, deviceConfig.ip, deviceConfig.token, this.log);

    await device.connect();
    await device.getState();

    this.devices.set(uuid, device);

    try {
      let lightbulbAccessory: LightbulbAccessory;
      if (existingAccessory) {
        this.log.info('Restoring accessory from cache:', existingAccessory.displayName);
        existingAccessory.context.config = deviceConfig;
        lightbulbAccessory = new LightbulbAccessory(this, existingAccessory, device, index);
      } else {
        this.log.info('Adding new accessory:', deviceConfig.name);
        const accessory = new this.api.platformAccessory(deviceConfig.name, uuid);
        accessory.context.config = deviceConfig;
        lightbulbAccessory = new LightbulbAccessory(this, accessory, device, index);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
      this.lightbulbAccessories.push(lightbulbAccessory);
    } catch (error) {
      this.log.error(`Failed to create accessory for ${deviceConfig.name}:`, error);
      device.disconnect();
      this.devices.delete(uuid);
    }
  }

  private disconnectAllDevices(): void {
    // Stop polling on all accessories
    for (const accessory of this.lightbulbAccessories) {
      accessory.stopPolling();
    }
    this.lightbulbAccessories.length = 0;

    // Disconnect all devices
    for (const device of this.devices.values()) {
      device.disconnect();
    }
    this.devices.clear();
  }
}
