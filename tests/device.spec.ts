import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YeelinkLightColor3 } from '../src/devices/yeelink.light.color3';
import type { LoggerType } from '../src/types';

vi.mock('miio', () => {
  return {
    default: {
      device: vi.fn(),
    },
  };
});

import miio from 'miio';

const mockLog: LoggerType = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
  success: vi.fn(),
} as unknown as LoggerType;

function createMockDevice() {
  return {
    call: vi.fn().mockResolvedValue(['ok']),
    destroy: vi.fn(),
  };
}

describe('BaseDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('connection timeout', () => {
    it('rejects after 10s when miio.device() hangs', async () => {
      vi.useFakeTimers();

      const handler = (_reason: unknown, _promise: Promise<unknown>) => {};
      process.on('unhandledRejection', handler);

      vi.mocked(miio.device).mockImplementation(() => new Promise(() => {}));

      const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
      const connectPromise = device.connect();

      await vi.advanceTimersByTimeAsync(10000);

      await expect(connectPromise).rejects.toThrow('Connection to 192.168.1.100 timed out');

      process.removeListener('unhandledRejection', handler);
    });

    it('connects successfully when miio.device() resolves in time', async () => {
      const mockDev = createMockDevice();
      vi.mocked(miio.device).mockResolvedValue(mockDev);

      const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
      await device.connect();

      expect(device.isConnected()).toBe(true);
    });
  });

  describe('shutdown guard', () => {
    it('rejects calls after disconnect', async () => {
      const mockDev = createMockDevice();
      vi.mocked(miio.device).mockResolvedValue(mockDev);

      const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
      await device.connect();

      device.disconnect();

      await expect(device.setPower(true)).rejects.toThrow('Device is shutting down');
    });

    it('destroys device on disconnect', async () => {
      const mockDev = createMockDevice();
      vi.mocked(miio.device).mockResolvedValue(mockDev);

      const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
      await device.connect();
      device.disconnect();

      expect(mockDev.destroy).toHaveBeenCalled();
      expect(device.isConnected()).toBe(false);
    });
  });

  describe('reconnect safety', () => {
    it('destroys and nulls device on call failure, then reconnects on next call', async () => {
      const mockDev1 = createMockDevice();
      mockDev1.call.mockRejectedValueOnce(new Error('network error'));
      vi.mocked(miio.device).mockResolvedValueOnce(mockDev1);

      const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
      await device.connect();

      await expect(device.setPower(true)).rejects.toThrow('network error');
      expect(mockDev1.destroy).toHaveBeenCalled();

      const mockDev2 = createMockDevice();
      vi.mocked(miio.device).mockResolvedValueOnce(mockDev2);

      await device.setPower(false);
      expect(mockDev2.call).toHaveBeenCalledWith('set_power', ['off', 'smooth', 500]);
    });
  });

  describe('state parsing', () => {
    it('parses valid device response and updates cachedState', async () => {
      const mockDev = createMockDevice();
      mockDev.call.mockResolvedValueOnce(['on', '75', '4000', '16711680', '180', '50', '1']);
      vi.mocked(miio.device).mockResolvedValue(mockDev);

      const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
      await device.connect();
      const state = await device.getState();

      expect(state).toEqual({
        power: true,
        brightness: 75,
        colorTemp: 4000,
        hue: 180,
        saturation: 50,
        colorMode: 'ct',
      });
    });

    it('returns cached state on invalid response', async () => {
      const mockDev = createMockDevice();
      mockDev.call.mockResolvedValueOnce(['on']);
      vi.mocked(miio.device).mockResolvedValue(mockDev);

      const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
      await device.connect();
      const state = await device.getState();

      expect(state).toEqual(device.cachedState);
    });
  });
});

describe('YeelightColorDevice HSV debounce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a single set_hsv call when setHue and setSaturation are called in rapid succession', async () => {
    const mockDev = createMockDevice();
    vi.mocked(miio.device).mockResolvedValue(mockDev);

    const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
    await device.connect();

    const huePromise = device.setHue(180);
    const satPromise = device.setSaturation(80);

    await vi.advanceTimersByTimeAsync(100);

    await Promise.all([huePromise, satPromise]);

    const hsvCalls = mockDev.call.mock.calls.filter(
      (c: [string, (string | number)[]]) => c[0] === 'set_hsv',
    );
    expect(hsvCalls).toHaveLength(1);
    expect(hsvCalls[0]).toEqual(['set_hsv', [180, 80, 'smooth', 500]]);
  });

  it('uses latest values when setHue is called multiple times rapidly', async () => {
    const mockDev = createMockDevice();
    vi.mocked(miio.device).mockResolvedValue(mockDev);

    const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
    await device.connect();

    const p1 = device.setHue(100);
    const p2 = device.setHue(200);
    const p3 = device.setHue(300);

    await vi.advanceTimersByTimeAsync(100);

    await Promise.all([p1, p2, p3]);

    const hsvCalls = mockDev.call.mock.calls.filter(
      (c: [string, (string | number)[]]) => c[0] === 'set_hsv',
    );
    expect(hsvCalls).toHaveLength(1);
    expect(hsvCalls[0][1][0]).toBe(300);
  });

  it('clearPendingUpdates cancels pending HSV flush', async () => {
    const mockDev = createMockDevice();
    vi.mocked(miio.device).mockResolvedValue(mockDev);

    const device = new YeelinkLightColor3('192.168.1.100', 'token123', mockLog);
    await device.connect();

    device.setHue(180);
    device.clearPendingUpdates();

    await vi.advanceTimersByTimeAsync(200);

    const hsvCalls = mockDev.call.mock.calls.filter(
      (c: [string, (string | number)[]]) => c[0] === 'set_hsv',
    );
    expect(hsvCalls).toHaveLength(0);
  });
});
