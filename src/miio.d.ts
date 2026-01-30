declare module 'miio' {
  export interface DeviceOptions {
    address: string;
    token: string;
  }

  export interface Device {
    call(method: string, params: (string | number)[]): Promise<unknown>;
    destroy(): void;
  }

  function device(options: DeviceOptions): Promise<Device>;

  const miio: {
    device: typeof device;
  };

  export default miio;
  export { Device, DeviceOptions };
}
