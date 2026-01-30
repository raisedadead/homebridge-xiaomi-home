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
      this.discoverDevices();
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

    for (const deviceConfig of deviceConfigs) {
      // Validate config
      if (!deviceConfig.name || !deviceConfig.ip || !deviceConfig.token || !deviceConfig.model) {
        this.log.error('Invalid device config, missing required fields:', deviceConfig);
        continue;
      }

      if (!supportedModels.includes(deviceConfig.model)) {
        this.log.error(
          `Unsupported model: ${deviceConfig.model}. Supported: ${supportedModels.join(', ')}`,
        );
        continue;
      }

      const uuid = this.api.hap.uuid.generate(`${deviceConfig.ip}-${deviceConfig.model}`);
      const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);

      try {
        const device = createDevice(
          deviceConfig.model,
          deviceConfig.ip,
          deviceConfig.token,
          this.log,
        );

        await device.connect();
        this.devices.set(uuid, device);

        if (existingAccessory) {
          this.log.info('Restoring accessory from cache:', existingAccessory.displayName);
          existingAccessory.context.config = deviceConfig;
          new LightbulbAccessory(this, existingAccessory, device);
        } else {
          this.log.info('Adding new accessory:', deviceConfig.name);
          const accessory = new this.api.platformAccessory(deviceConfig.name, uuid);
          accessory.context.config = deviceConfig;
          new LightbulbAccessory(this, accessory, device);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      } catch (error) {
        this.log.error(`Failed to initialize device ${deviceConfig.name}:`, error);
      }
    }

    // Remove stale accessories
    const configuredUUIDs = deviceConfigs.map(d =>
      this.api.hap.uuid.generate(`${d.ip}-${d.model}`),
    );
    const staleAccessories = this.accessories.filter(acc => !configuredUUIDs.includes(acc.UUID));

    if (staleAccessories.length > 0) {
      this.log.info(
        'Removing stale accessories:',
        staleAccessories.map(a => a.displayName),
      );
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }
  }

  private disconnectAllDevices(): void {
    for (const device of this.devices.values()) {
      device.disconnect();
    }
    this.devices.clear();
  }
}
