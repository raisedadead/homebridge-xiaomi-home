import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Mired/Kelvin Conversions', () => {
  const kelvinToMired = (kelvin: number): number => {
    if (kelvin <= 0) return 500;
    return Math.round(1000000 / kelvin);
  };

  const miredToKelvin = (mired: number): number => {
    if (mired <= 0) return 2000;
    return Math.round(1000000 / mired);
  };

  const clampMired = (mired: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, mired));
  };

  describe('kelvinToMired', () => {
    it('converts 6500K to ~154 mired', () => {
      expect(kelvinToMired(6500)).toBe(154);
    });

    it('converts 2700K to ~370 mired', () => {
      expect(kelvinToMired(2700)).toBe(370);
    });

    it('converts 1700K to ~588 mired', () => {
      expect(kelvinToMired(1700)).toBe(588);
    });

    it('handles zero kelvin safely', () => {
      expect(kelvinToMired(0)).toBe(500);
    });

    it('handles negative kelvin safely', () => {
      expect(kelvinToMired(-100)).toBe(500);
    });
  });

  describe('miredToKelvin', () => {
    it('converts 154 mired to ~6494K', () => {
      expect(miredToKelvin(154)).toBe(6494);
    });

    it('converts 370 mired to ~2703K', () => {
      expect(miredToKelvin(370)).toBe(2703);
    });

    it('handles zero mired safely', () => {
      expect(miredToKelvin(0)).toBe(2000);
    });

    it('handles negative mired safely', () => {
      expect(miredToKelvin(-100)).toBe(2000);
    });
  });

  describe('clampMired', () => {
    const min = 154;
    const max = 588;

    it('clamps value below minimum', () => {
      expect(clampMired(100, min, max)).toBe(154);
    });

    it('clamps value above maximum', () => {
      expect(clampMired(700, min, max)).toBe(588);
    });

    it('returns value within range unchanged', () => {
      expect(clampMired(300, min, max)).toBe(300);
    });

    it('handles edge cases at boundaries', () => {
      expect(clampMired(154, min, max)).toBe(154);
      expect(clampMired(588, min, max)).toBe(588);
    });
  });
});

describe('State Parsing', () => {
  const parseState = (props: string[]) => {
    if (!Array.isArray(props) || props.length < 7) {
      return null;
    }

    const brightness = parseInt(props[1], 10);
    const colorTemp = parseInt(props[2], 10);
    const hue = parseInt(props[4], 10);
    const saturation = parseInt(props[5], 10);

    return {
      power: props[0] === 'on',
      brightness: isNaN(brightness) ? 100 : brightness,
      colorTemp: isNaN(colorTemp) ? 4000 : colorTemp,
      hue: isNaN(hue) ? 0 : hue,
      saturation: isNaN(saturation) ? 0 : saturation,
      colorMode: String(props[6]) === '1' ? 'ct' : String(props[6]) === '2' ? 'rgb' : 'hsv',
    };
  };

  it('parses valid device response', () => {
    const props = ['on', '75', '4000', '16711680', '180', '50', '1'];
    const state = parseState(props);

    expect(state).toEqual({
      power: true,
      brightness: 75,
      colorTemp: 4000,
      hue: 180,
      saturation: 50,
      colorMode: 'ct',
    });
  });

  it('handles off state', () => {
    const props = ['off', '100', '3000', '0', '0', '0', '2'];
    const state = parseState(props);

    expect(state?.power).toBe(false);
    expect(state?.colorMode).toBe('rgb');
  });

  it('handles numeric color mode', () => {
    const props = ['on', '100', '3000', '0', '0', '0', 1]; // number instead of string
    const state = parseState(props as unknown as string[]);

    expect(state?.colorMode).toBe('ct');
  });

  it('returns null for invalid response', () => {
    expect(parseState([])).toBeNull();
    expect(parseState(['on', '100'])).toBeNull();
  });

  it('handles NaN values with defaults', () => {
    const props = ['on', '', 'invalid', '0', 'bad', 'data', '3'];
    const state = parseState(props);

    expect(state?.brightness).toBe(100);
    expect(state?.colorTemp).toBe(4000);
    expect(state?.hue).toBe(0);
    expect(state?.saturation).toBe(0);
  });
});

describe('Value Clamping', () => {
  const clampBrightness = (level: number): number => Math.max(1, Math.min(100, level));
  const clampHue = (hue: number): number => Math.max(0, Math.min(360, hue));
  const clampSaturation = (sat: number): number => Math.max(0, Math.min(100, sat));

  describe('brightness', () => {
    it('clamps to 1-100 range', () => {
      expect(clampBrightness(0)).toBe(1);
      expect(clampBrightness(-10)).toBe(1);
      expect(clampBrightness(150)).toBe(100);
      expect(clampBrightness(50)).toBe(50);
    });
  });

  describe('hue', () => {
    it('clamps to 0-360 range', () => {
      expect(clampHue(-10)).toBe(0);
      expect(clampHue(400)).toBe(360);
      expect(clampHue(180)).toBe(180);
      expect(clampHue(360)).toBe(360);
    });
  });

  describe('saturation', () => {
    it('clamps to 0-100 range', () => {
      expect(clampSaturation(-10)).toBe(0);
      expect(clampSaturation(150)).toBe(100);
      expect(clampSaturation(50)).toBe(50);
    });
  });
});

// ---- LightbulbAccessory integration tests ----

vi.mock('miio', () => ({
  default: { device: vi.fn() },
  device: vi.fn(),
}));

vi.mock('homebridge', () => ({}));

vi.mock('../src/devices', () => ({
  BaseDevice: class {},
}));

vi.mock('../src/platform', () => ({
  XiaomiHomePlatform: class {},
}));

class MockHapStatusError extends Error {
  constructor(public hapStatus: number) {
    super(`HAPStatus: ${hapStatus}`);
  }
}

const createMockDevice = () => ({
  model: 'yeelink.light.color3',
  name: 'Test Light',
  capabilities: { power: true, brightness: true, colorTemperature: true, color: true },
  colorTempRange: { min: 1700, max: 6500 },
  cachedState: {
    power: true,
    brightness: 75,
    colorTemp: 4000,
    hue: 180,
    saturation: 50,
    colorMode: 'ct' as const,
  },
  isConnected: vi.fn().mockReturnValue(true),
  getState: vi.fn(),
  setPower: vi.fn(),
  setBrightness: vi.fn(),
  setColorTemperature: vi.fn(),
  setHue: vi.fn(),
  setSaturation: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
});

const createMockCharacteristic = () => {
  const char: Record<string, unknown> = {};
  char.onGet = vi.fn().mockReturnValue(char);
  char.onSet = vi.fn().mockReturnValue(char);
  char.setProps = vi.fn().mockReturnValue(char);
  return char;
};

const createMockService = () => {
  const characteristics = new Map<string, ReturnType<typeof createMockCharacteristic>>();
  return {
    getCharacteristic: vi.fn().mockImplementation((name: string) => {
      if (!characteristics.has(name)) {
        characteristics.set(name, createMockCharacteristic());
      }
      return characteristics.get(name);
    }),
    setCharacteristic: vi.fn().mockReturnThis(),
    updateCharacteristic: vi.fn(),
    _characteristics: characteristics,
  };
};

const createMockAccessory = () => {
  const lightbulbService = createMockService();
  const infoService = createMockService();
  return {
    getService: vi.fn().mockImplementation((name: string) => {
      if (name === 'AccessoryInformation') return infoService;
      if (name === 'Lightbulb') return lightbulbService;
      return null;
    }),
    addService: vi.fn().mockReturnValue(lightbulbService),
    displayName: 'Test Light',
    UUID: 'test-uuid',
    context: { config: { ip: '192.168.1.100', name: 'Test Light' } },
    _lightbulbService: lightbulbService,
    _infoService: infoService,
  };
};

const createMockPlatform = () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  config: { pollingInterval: 15 },
  api: {
    hap: {
      HapStatusError: MockHapStatusError,
      HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
    },
  },
  Service: {
    Lightbulb: 'Lightbulb',
    AccessoryInformation: 'AccessoryInformation',
  },
  Characteristic: {
    On: 'On',
    Brightness: 'Brightness',
    ColorTemperature: 'ColorTemperature',
    Hue: 'Hue',
    Saturation: 'Saturation',
    StatusActive: 'StatusActive',
    Name: 'Name',
    Manufacturer: 'Manufacturer',
    Model: 'Model',
    SerialNumber: 'SerialNumber',
    FirmwareRevision: 'FirmwareRevision',
  },
});

type HandlerMap = Map<string, { onGet?: () => unknown; onSet?: (v: unknown) => unknown }>;

function extractHandlers(mockAccessory: ReturnType<typeof createMockAccessory>): HandlerMap {
  const service = mockAccessory._lightbulbService;
  const handlers: HandlerMap = new Map();
  for (const [name, char] of service._characteristics) {
    const onGetFn = char.onGet as ReturnType<typeof vi.fn>;
    const onSetFn = char.onSet as ReturnType<typeof vi.fn>;
    const getHandler =
      onGetFn.mock.calls.length > 0 ? (onGetFn.mock.calls[0] as [() => unknown])[0] : undefined;
    const setHandler =
      onSetFn.mock.calls.length > 0
        ? (onSetFn.mock.calls[0] as [(v: unknown) => unknown])[0]
        : undefined;
    handlers.set(name, { onGet: getHandler, onSet: setHandler });
  }
  return handlers;
}

describe('LightbulbAccessory', () => {
  let mockDevice: ReturnType<typeof createMockDevice>;
  let mockPlatform: ReturnType<typeof createMockPlatform>;
  let mockAccessory: ReturnType<typeof createMockAccessory>;
  let handlers: HandlerMap;

  beforeEach(async () => {
    vi.useFakeTimers();
    mockDevice = createMockDevice();
    mockPlatform = createMockPlatform();
    mockAccessory = createMockAccessory();

    const { LightbulbAccessory } = await import('../src/accessories/lightbulb');
    new LightbulbAccessory(mockPlatform as never, mockAccessory as never, mockDevice as never, 0);

    handlers = extractHandlers(mockAccessory);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('onGet returns cached state', () => {
    it('getOn returns cached power without calling device.getState', async () => {
      const handler = handlers.get('On')?.onGet;
      expect(handler).toBeDefined();
      const result = await handler!();
      expect(result).toBe(true);
      expect(mockDevice.getState).not.toHaveBeenCalled();
    });

    it('getBrightness returns cached brightness', async () => {
      const handler = handlers.get('Brightness')?.onGet;
      expect(handler).toBeDefined();
      const result = await handler!();
      expect(result).toBe(75);
      expect(mockDevice.getState).not.toHaveBeenCalled();
    });

    it('getColorTemperature returns cached color temp as clamped mired', async () => {
      const handler = handlers.get('ColorTemperature')?.onGet;
      expect(handler).toBeDefined();
      const result = await handler!();
      expect(result).toBe(250); // 1000000/4000 = 250
      expect(mockDevice.getState).not.toHaveBeenCalled();
    });

    it('getHue returns cached hue', async () => {
      const handler = handlers.get('Hue')?.onGet;
      expect(handler).toBeDefined();
      const result = await handler!();
      expect(result).toBe(180);
      expect(mockDevice.getState).not.toHaveBeenCalled();
    });

    it('getSaturation returns cached saturation', async () => {
      const handler = handlers.get('Saturation')?.onGet;
      expect(handler).toBeDefined();
      const result = await handler!();
      expect(result).toBe(50);
      expect(mockDevice.getState).not.toHaveBeenCalled();
    });
  });

  describe('setOn handles boolean and numeric values', () => {
    it('handles true', async () => {
      mockDevice.setPower.mockResolvedValue(undefined);
      const handler = handlers.get('On')?.onSet;
      await handler!(true);
      expect(mockDevice.setPower).toHaveBeenCalledWith(true);
    });

    it('handles false', async () => {
      mockDevice.setPower.mockResolvedValue(undefined);
      const handler = handlers.get('On')?.onSet;
      await handler!(false);
      expect(mockDevice.setPower).toHaveBeenCalledWith(false);
    });

    it('handles 1 as true', async () => {
      mockDevice.setPower.mockResolvedValue(undefined);
      const handler = handlers.get('On')?.onSet;
      await handler!(1);
      expect(mockDevice.setPower).toHaveBeenCalledWith(true);
    });

    it('handles 0 as false', async () => {
      mockDevice.setPower.mockResolvedValue(undefined);
      const handler = handlers.get('On')?.onSet;
      await handler!(0);
      expect(mockDevice.setPower).toHaveBeenCalledWith(false);
    });
  });

  describe('onSet throws HapStatusError on failure', () => {
    it('setOn throws HapStatusError', async () => {
      mockDevice.setPower.mockRejectedValue(new Error('timeout'));
      const handler = handlers.get('On')?.onSet;
      await expect(handler!(true)).rejects.toBeInstanceOf(MockHapStatusError);
      await expect(handler!(true)).rejects.toMatchObject({ hapStatus: -70402 });
    });

    it('setBrightness throws HapStatusError', async () => {
      mockDevice.setBrightness.mockRejectedValue(new Error('timeout'));
      const handler = handlers.get('Brightness')?.onSet;
      await expect(handler!(50)).rejects.toBeInstanceOf(MockHapStatusError);
    });

    it('setColorTemperature throws HapStatusError', async () => {
      mockDevice.setColorTemperature.mockRejectedValue(new Error('timeout'));
      const handler = handlers.get('ColorTemperature')?.onSet;
      await expect(handler!(300)).rejects.toBeInstanceOf(MockHapStatusError);
    });

    it('setHue throws HapStatusError', async () => {
      mockDevice.setHue.mockRejectedValue(new Error('timeout'));
      const handler = handlers.get('Hue')?.onSet;
      await expect(handler!(120)).rejects.toBeInstanceOf(MockHapStatusError);
    });

    it('setSaturation throws HapStatusError', async () => {
      mockDevice.setSaturation.mockRejectedValue(new Error('timeout'));
      const handler = handlers.get('Saturation')?.onSet;
      await expect(handler!(80)).rejects.toBeInstanceOf(MockHapStatusError);
    });
  });

  describe('StatusActive', () => {
    it('registers StatusActive onGet handler', () => {
      const handler = handlers.get('StatusActive')?.onGet;
      expect(handler).toBeDefined();
    });

    it('returns device connectivity status', () => {
      mockDevice.isConnected.mockReturnValue(true);
      const handler = handlers.get('StatusActive')?.onGet;
      expect(handler!()).toBe(true);

      mockDevice.isConnected.mockReturnValue(false);
      expect(handler!()).toBe(false);
    });

    it('updates StatusActive to true on successful poll', async () => {
      const state = {
        power: true,
        brightness: 50,
        colorTemp: 3000,
        hue: 0,
        saturation: 0,
        colorMode: 'ct' as const,
      };
      mockDevice.getState.mockResolvedValue(state);

      await vi.advanceTimersByTimeAsync(0);

      expect(mockAccessory._lightbulbService.updateCharacteristic).toHaveBeenCalledWith(
        'StatusActive',
        true,
      );
    });

    it('updates StatusActive to false on poll failure', async () => {
      mockDevice.getState.mockRejectedValue(new Error('offline'));

      await vi.advanceTimersByTimeAsync(0);

      expect(mockAccessory._lightbulbService.updateCharacteristic).toHaveBeenCalledWith(
        'StatusActive',
        false,
      );
    });
  });

  describe('first poll stagger', () => {
    it('fires first poll immediately for device index 0', async () => {
      mockDevice.getState.mockResolvedValue(mockDevice.cachedState);

      await vi.advanceTimersByTimeAsync(0);

      expect(mockDevice.getState).toHaveBeenCalled();
    });

    it('staggers first poll by 2s per device index', async () => {
      const device2 = createMockDevice();
      const platform2 = createMockPlatform();
      const accessory2 = createMockAccessory();

      const { LightbulbAccessory } = await import('../src/accessories/lightbulb');
      new LightbulbAccessory(platform2 as never, accessory2 as never, device2 as never, 3);

      await vi.advanceTimersByTimeAsync(5999);
      expect(device2.getState).not.toHaveBeenCalled();

      device2.getState.mockResolvedValue(device2.cachedState);
      await vi.advanceTimersByTimeAsync(1);
      expect(device2.getState).toHaveBeenCalled();
    });
  });

  describe('FirmwareRevision', () => {
    it('sets FirmwareRevision on accessory info', () => {
      expect(mockAccessory._infoService.setCharacteristic).toHaveBeenCalledWith(
        'FirmwareRevision',
        '1.0.0',
      );
    });
  });
});
