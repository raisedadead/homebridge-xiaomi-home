import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('miio', () => ({
  default: { device: vi.fn() },
  device: vi.fn(),
}));

vi.mock('homebridge', () => ({}));

const mockLightbulbAccessory = vi.fn().mockImplementation(() => ({
  stopPolling: vi.fn(),
}));

vi.mock('../src/devices', () => {
  return {
    createDevice: vi.fn(),
    getSupportedModels: vi.fn().mockReturnValue(['yeelink.light.color3', 'yeelink.light.bslamp2']),
    BaseDevice: class {},
  };
});

vi.mock('../src/accessories', () => {
  return {
    LightbulbAccessory: mockLightbulbAccessory,
  };
});

import { createDevice } from '../src/devices';

const createMockDevice = (overrides = {}) => ({
  model: 'yeelink.light.color3',
  name: 'Test Light',
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  getState: vi.fn().mockResolvedValue({
    power: true,
    brightness: 75,
    colorTemp: 4000,
    hue: 0,
    saturation: 0,
    colorMode: 'ct' as const,
  }),
  isConnected: vi.fn().mockReturnValue(true),
  ...overrides,
});

const createMockApi = () => {
  const eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    hap: {
      Service: { Lightbulb: 'Lightbulb', AccessoryInformation: 'AccessoryInformation' },
      Characteristic: {},
      uuid: { generate: vi.fn((input: string) => `uuid-${input}`) },
      HapStatusError: class extends Error {
        constructor(public hapStatus: number) {
          super(`HAPStatus: ${hapStatus}`);
        }
      },
      HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      eventHandlers[event].push(handler);
    }),
    registerPlatformAccessories: vi.fn(),
    unregisterPlatformAccessories: vi.fn(),
    platformAccessory: vi.fn().mockImplementation(function (
      this: Record<string, unknown>,
      name: string,
      uuid: string,
    ) {
      this.displayName = name;
      this.UUID = uuid;
      this.context = {};
      this.getService = vi.fn();
      this.addService = vi.fn();
    }),
    _trigger: async (event: string) => {
      for (const handler of eventHandlers[event] || []) {
        handler();
      }
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    },
  };
};

const createMockLog = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

describe('XiaomiHomePlatform', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let mockLog: ReturnType<typeof createMockLog>;
  const mockedCreateDevice = vi.mocked(createDevice);

  beforeEach(() => {
    vi.clearAllMocks();
    mockLightbulbAccessory.mockImplementation(() => ({
      stopPolling: vi.fn(),
    }));
    mockApi = createMockApi();
    mockLog = createMockLog();
  });

  async function createPlatformAndDiscover(devices: unknown[] = []) {
    const { XiaomiHomePlatform } = await import('../src/platform');
    const config = {
      platform: 'XiaomiHome',
      name: 'Xiaomi Home',
      devices,
    };
    const platform = new XiaomiHomePlatform(mockLog as never, config as never, mockApi as never);
    await mockApi._trigger('didFinishLaunching');
    return platform;
  }

  describe('parallel discovery', () => {
    it('initializes multiple devices in parallel', async () => {
      const device1 = createMockDevice();
      const device2 = createMockDevice();
      mockedCreateDevice
        .mockReturnValueOnce(device1 as never)
        .mockReturnValueOnce(device2 as never);

      const configs = [
        { name: 'Light 1', ip: '192.168.1.10', token: 'aaa', model: 'yeelink.light.color3' },
        { name: 'Light 2', ip: '192.168.1.11', token: 'bbb', model: 'yeelink.light.color3' },
      ];
      await createPlatformAndDiscover(configs);

      expect(mockedCreateDevice).toHaveBeenCalledTimes(2);
      expect(device1.connect).toHaveBeenCalled();
      expect(device2.connect).toHaveBeenCalled();
    });

    it('one offline device does not block others', async () => {
      const device1 = createMockDevice({
        connect: vi.fn().mockRejectedValue(new Error('timeout')),
      });
      const device2 = createMockDevice();
      mockedCreateDevice
        .mockReturnValueOnce(device1 as never)
        .mockReturnValueOnce(device2 as never);

      const configs = [
        { name: 'Offline', ip: '192.168.1.10', token: 'aaa', model: 'yeelink.light.color3' },
        { name: 'Online', ip: '192.168.1.11', token: 'bbb', model: 'yeelink.light.color3' },
      ];
      await createPlatformAndDiscover(configs);

      expect(mockLightbulbAccessory).toHaveBeenCalledTimes(1);
      expect(mockLog.error).toHaveBeenCalledWith(
        'Device initialization failed:',
        expect.any(Error),
      );
    });
  });

  describe('cache priming', () => {
    it('calls getState after connect', async () => {
      const device = createMockDevice();
      mockedCreateDevice.mockReturnValue(device as never);

      const configs = [
        { name: 'Light', ip: '192.168.1.10', token: 'aaa', model: 'yeelink.light.color3' },
      ];
      await createPlatformAndDiscover(configs);

      expect(device.connect).toHaveBeenCalled();
      expect(device.getState).toHaveBeenCalled();
      const connectOrder = device.connect.mock.invocationCallOrder[0];
      const getStateOrder = device.getState.mock.invocationCallOrder[0];
      expect(connectOrder).toBeLessThan(getStateOrder);
    });
  });

  describe('stale accessory cleanup', () => {
    it('removes accessories not in config', async () => {
      const device = createMockDevice();
      mockedCreateDevice.mockReturnValue(device as never);

      const configs = [
        { name: 'Light', ip: '192.168.1.10', token: 'aaa', model: 'yeelink.light.color3' },
      ];

      const { XiaomiHomePlatform } = await import('../src/platform');
      const config = {
        platform: 'XiaomiHome',
        name: 'Xiaomi Home',
        devices: configs,
      };
      const platform = new XiaomiHomePlatform(mockLog as never, config as never, mockApi as never);

      const staleAccessory = {
        displayName: 'Old Light',
        UUID: 'uuid-stale',
        context: {},
      };
      platform.configureAccessory(staleAccessory as never);

      await mockApi._trigger('didFinishLaunching');

      expect(mockApi.unregisterPlatformAccessories).toHaveBeenCalledWith(
        'homebridge-xiaomi-home',
        'XiaomiHome',
        [staleAccessory],
      );
    });
  });

  describe('accessory constructor failure handling', () => {
    it('disconnects device and removes from map on constructor failure', async () => {
      const device = createMockDevice();
      mockedCreateDevice.mockReturnValue(device as never);
      mockLightbulbAccessory.mockImplementationOnce(() => {
        throw new Error('constructor failed');
      });

      const configs = [
        { name: 'Light', ip: '192.168.1.10', token: 'aaa', model: 'yeelink.light.color3' },
      ];
      await createPlatformAndDiscover(configs);

      expect(device.disconnect).toHaveBeenCalled();
      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to create accessory for Light:',
        expect.any(Error),
      );
    });
  });

  describe('invalid config filtering', () => {
    it('filters out configs with missing fields', async () => {
      const device = createMockDevice();
      mockedCreateDevice.mockReturnValue(device as never);

      const configs = [
        { name: '', ip: '192.168.1.10', token: 'aaa', model: 'yeelink.light.color3' },
        { name: 'Good', ip: '192.168.1.11', token: 'bbb', model: 'yeelink.light.color3' },
      ];
      await createPlatformAndDiscover(configs);

      expect(mockedCreateDevice).toHaveBeenCalledTimes(1);
      expect(mockLog.error).toHaveBeenCalledWith(
        'Invalid device config, missing required fields:',
        expect.objectContaining({ name: '' }),
      );
    });

    it('filters out unsupported models', async () => {
      const device = createMockDevice();
      mockedCreateDevice.mockReturnValue(device as never);

      const configs = [
        { name: 'Bad', ip: '192.168.1.10', token: 'aaa', model: 'unsupported.model' },
        { name: 'Good', ip: '192.168.1.11', token: 'bbb', model: 'yeelink.light.color3' },
      ];
      await createPlatformAndDiscover(configs);

      expect(mockedCreateDevice).toHaveBeenCalledTimes(1);
      expect(mockLog.error).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported model: unsupported.model'),
      );
    });

    it('warns when no devices are configured', async () => {
      await createPlatformAndDiscover([]);

      expect(mockLog.warn).toHaveBeenCalledWith(
        'No devices configured. Add devices to your config.json.',
      );
    });
  });

  describe('device index passed to accessory', () => {
    it('passes correct index to LightbulbAccessory constructor', async () => {
      const device1 = createMockDevice();
      const device2 = createMockDevice();
      mockedCreateDevice
        .mockReturnValueOnce(device1 as never)
        .mockReturnValueOnce(device2 as never);

      const configs = [
        { name: 'Light 0', ip: '192.168.1.10', token: 'aaa', model: 'yeelink.light.color3' },
        { name: 'Light 1', ip: '192.168.1.11', token: 'bbb', model: 'yeelink.light.color3' },
      ];
      await createPlatformAndDiscover(configs);

      expect(mockLightbulbAccessory).toHaveBeenCalledTimes(2);
      const call0 = mockLightbulbAccessory.mock.calls[0];
      const call1 = mockLightbulbAccessory.mock.calls[1];
      expect(call0[3]).toBe(0);
      expect(call1[3]).toBe(1);
    });
  });
});
