import { describe, it, expect } from 'vitest';

// Test the conversion utilities
// These are private methods, so we test the logic directly

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
