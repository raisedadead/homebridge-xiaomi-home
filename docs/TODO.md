# TODO - Future Work

This document tracks deferred issues and improvements for the homebridge-xiaomi-home plugin.

---

## High Priority

### HSV Race Condition (#5-6)

**Problem:** When using the color picker in HomeKit, `setHue()` and `setSaturation()` are called in rapid succession.
Each method reads from `cachedState` for the other value, causing stale data issues.

**Example scenario:**

1. User drags color picker
2. HomeKit calls `setHue(180)` - reads `cachedState.saturation` (50)
3. HomeKit calls `setSaturation(80)` - reads `cachedState.hue` (still old value, not 180)
4. Result: Color is wrong because calls used stale values

**Affected files:**

- `src/devices/yeelight-color.ts:79-90` (setHue/setSaturation methods)

**Solution approaches:**

1. **Debouncing (Recommended):**

   ```typescript
   private pendingHSV: { hue?: number; sat?: number } = {};
   private hsvDebounceTimer: ReturnType<typeof setTimeout> | null = null;

   async setHue(hue: number): Promise<void> {
     this.pendingHSV.hue = Math.max(0, Math.min(360, hue));
     this.debouncedHSVUpdate();
   }

   async setSaturation(sat: number): Promise<void> {
     this.pendingHSV.sat = Math.max(0, Math.min(100, sat));
     this.debouncedHSVUpdate();
   }

   private debouncedHSVUpdate(): void {
     if (this.hsvDebounceTimer) clearTimeout(this.hsvDebounceTimer);
     this.hsvDebounceTimer = setTimeout(async () => {
       const hue = this.pendingHSV.hue ?? this.cachedState.hue;
       const sat = this.pendingHSV.sat ?? this.cachedState.saturation;
       await this.call('set_hsv', [hue, sat, 'smooth', 500]);
       this.cachedState.hue = hue;
       this.cachedState.saturation = sat;
       this.pendingHSV = {};
     }, 100); // 100ms debounce
   }
   ```

2. **Fetch fresh state before set:**
   - More accurate but adds latency
   - Network call for every color change

**Testing needed:**

- Manual test with color picker rapid movements
- Unit test with concurrent setHue/setSaturation calls

---

## Medium Priority

### Incomplete miio Type Declarations (#19)

**Problem:** The `src/miio.d.ts` file has minimal type coverage. Missing:

- Error types from miio library
- Connection event types
- Device discovery types
- Full method signatures

**Affected files:**

- `src/miio.d.ts`

**Current state:**

```typescript
export interface Device {
  call(method: string, params: (string | number)[]): Promise<unknown>;
  destroy(): void;
}
```

**Ideal state:**

```typescript
export interface MiioError extends Error {
  code: 'timeout' | 'token' | 'network' | string;
  device: Device | null;
}

export interface Device {
  call<T = unknown>(method: string, params: readonly (string | number)[]): Promise<T>;
  destroy(): void;
  on(event: 'connected', listener: () => void): this;
  on(event: 'disconnected', listener: () => void): this;
  on(event: 'error', listener: (error: MiioError) => void): this;
}

export interface DiscoveryOptions {
  cacheTime?: number;
}

export function devices(options?: DiscoveryOptions): AsyncIterable<Device>;
export function browse(options?: DiscoveryOptions): EventEmitter;
```

**Resources:**

- miio source: https://github.com/aholstenson/miio
- API reference needed from library inspection

---

### setOn() Value Casting (#20)

**Problem:** `setOn(value: CharacteristicValue)` casts `value as boolean`, but HomeKit may send `0`/`1` for
compatibility with older accessories.

**Affected files:**

- `src/accessories/lightbulb.ts:143`

**Current code:**

```typescript
async setOn(value: CharacteristicValue): Promise<void> {
  await this.device.setPower(value as boolean);
}
```

**Fix:**

```typescript
async setOn(value: CharacteristicValue): Promise<void> {
  const power = value === true || value === 1;
  await this.device.setPower(power);
}
```

**Testing needed:**

- Test with `value = true`, `value = false`
- Test with `value = 1`, `value = 0`

---

### lightbulbAccessories Cleanup on Error (#18)

**Problem:** If `LightbulbAccessory` constructor fails partway through, the array `lightbulbAccessories` may contain
partial state, causing issues on shutdown cleanup.

**Affected files:**

- `src/platform.ts:95-103`

**Current code:**

```typescript
lightbulbAccessory = new LightbulbAccessory(this, accessory, device);
this.lightbulbAccessories.push(lightbulbAccessory);
```

**Fix:**

```typescript
try {
  lightbulbAccessory = new LightbulbAccessory(this, accessory, device);
  this.lightbulbAccessories.push(lightbulbAccessory);
} catch (error) {
  this.log.error(`Failed to create accessory for ${deviceConfig.name}:`, error);
  device.disconnect();
  this.devices.delete(uuid);
  continue;
}
```

---

## Low Priority

### miio Package Unmaintained (#23)

**Problem:** The `miio` package (v0.15.6) was last updated in 2019. Potential issues:

- No modern Node.js support guarantees
- Possible security vulnerabilities
- No bug fixes or improvements

**Current dependency:**

```json
"dependencies": {
  "miio": "^0.15.6"
}
```

**Alternatives to evaluate:**

1. **Fork miio** - Maintain our own version with fixes
2. **miio-api** - Alternative package (evaluate compatibility)
3. **Direct protocol implementation** - Maximum control but high effort

**Evaluation criteria:**

- Node 22/24 compatibility
- Security audit status
- Active maintenance
- API compatibility with current code

**Resources:**

- miio protocol docs: https://github.com/OpenMiHome/mihome-binary-protocol
- python-miio (reference): https://github.com/rytilahti/python-miio

---

## Completed

- [x] #8 - Polling backoff (exponential backoff implemented)
- [x] #11 - Schema required syntax (moved to top-level array)
- [x] #21-22 - DRY violation (created YeelightColorDevice base class)

---

## Testing Gaps

The following areas need more test coverage:

1. **Integration tests with mocked miio:**
   - Device connection success/failure
   - State polling with various responses
   - Command execution with errors

2. **Platform tests:**
   - Device discovery with valid/invalid configs
   - Accessory caching/restoration
   - Stale accessory removal

3. **Edge case tests:**
   - Network timeout handling
   - Invalid device responses
   - Concurrent operations

4. **End-to-end tests:**
   - Full HomeKit characteristic flow
   - Color picker interactions
   - Power/brightness controls
