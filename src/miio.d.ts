declare module 'miio' {
  export interface MiioError extends Error {
    code: string;
  }

  export interface Device {
    call(method: string, params: (string | number)[]): Promise<unknown>;
    destroy(): void;
  }

  export interface DeviceOptions {
    address: string;
    token: string;
  }

  function device(options: DeviceOptions): Promise<Device>;

  const miio: {
    device: typeof device;
  };

  export default miio;
}
