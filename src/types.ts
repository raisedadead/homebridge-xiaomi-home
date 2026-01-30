import { Logger } from 'homebridge';

export interface DeviceConfig {
  name: string;
  ip: string;
  token: string;
  model: string;
}

export interface DeviceState {
  power: boolean;
  brightness: number;
  colorTemp: number;
  hue: number;
  saturation: number;
  colorMode: 'ct' | 'rgb' | 'hsv';
}

export interface DeviceCapabilities {
  power: boolean;
  brightness: boolean;
  colorTemperature: boolean;
  color: boolean;
}

export type LoggerType = Logger;
