declare module 'miio' {
  interface DeviceOptions {
    address: string;
    token: string;
  }

  interface Device {
    call(method: string, params: any[]): Promise<any>;
    destroy(): void;
  }

  function device(options: DeviceOptions): Promise<Device>;

  export default { device };
}
