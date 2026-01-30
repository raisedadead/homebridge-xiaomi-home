import { BaseDevice } from './base';
import { YeelinkLightColor3 } from './yeelink.light.color3';
import { YeelinkLightBslamp2 } from './yeelink.light.bslamp2';
import { LoggerType } from '../types';

export { BaseDevice } from './base';
export { YeelinkLightColor3 } from './yeelink.light.color3';
export { YeelinkLightBslamp2 } from './yeelink.light.bslamp2';

type DeviceConstructor = new (ip: string, token: string, log: LoggerType) => BaseDevice;

const DeviceRegistry: Record<string, DeviceConstructor> = {
  'yeelink.light.color3': YeelinkLightColor3,
  'yeelink.light.bslamp2': YeelinkLightBslamp2,
};

export function createDevice(
  model: string,
  ip: string,
  token: string,
  log: LoggerType,
): BaseDevice {
  const DeviceClass = DeviceRegistry[model];
  if (!DeviceClass) {
    throw new Error(
      `Unsupported device model: ${model}. Supported models: ${Object.keys(DeviceRegistry).join(', ')}`,
    );
  }
  return new DeviceClass(ip, token, log);
}

export function getSupportedModels(): string[] {
  return Object.keys(DeviceRegistry);
}
