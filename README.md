# Homebridge Xiaomi Home

[![CI](https://github.com/raisedadead/homebridge-xiaomi-home/actions/workflows/ci.yml/badge.svg)](https://github.com/raisedadead/homebridge-xiaomi-home/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/homebridge-xiaomi-home.svg)](https://www.npmjs.com/package/homebridge-xiaomi-home)
[![npm downloads](https://img.shields.io/npm/dm/homebridge-xiaomi-home.svg)](https://www.npmjs.com/package/homebridge-xiaomi-home)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/node-%5E22%20%7C%7C%20%5E24-brightgreen.svg)](https://nodejs.org/)
[![Homebridge](https://img.shields.io/badge/homebridge-%5E1.8%20%7C%7C%20%5E2.0-purple.svg)](https://homebridge.io/)

> Control your Xiaomi lights from HomeKit, no cloud required.

## What is this about?

A [Homebridge](https://homebridge.io/) plugin for Xiaomi/Yeelight smart home devices using local network control via the [miio protocol](https://github.com/OpenMiHome/mihome-binary-protocol). Communicates directly with devices on your LAN — no cloud dependency.

## Features

- **Local Control** – No cloud dependency, works on your local network
- **Full Light Support** – Power, brightness, color temperature, and RGB
- **Real-time Polling** – Automatic state synchronization
- **HomeKit Native** – Full color picker support
- **Homebridge UI** – Easy configuration through the web interface
- **Secure** – Uses device tokens for authenticated local communication
- **Fast Response** – Direct device communication without cloud latency
- **Extensible** – Easy to add support for new device models

## Supported Devices

| Model                   | Name                    | Capabilities                              |
| ----------------------- | ----------------------- | ----------------------------------------- |
| `yeelink.light.color3`  | Yeelight Color Bulb 3   | Power, Brightness, Color Temperature, RGB |
| `yeelink.light.bslamp2` | Yeelight Bedside Lamp 2 | Power, Brightness, Color Temperature, RGB |

> More devices can be added! See [Contributing](#contributing).

## Installation

```bash
npm install -g homebridge-xiaomi-home
# or
pnpm add -g homebridge-xiaomi-home
# or
yarn global add homebridge-xiaomi-home
```

Or search for **"Xiaomi Home"** in the Homebridge UI plugins tab.

## Quick Start

### 1. Get Your Device Token

**Using [uv](https://docs.astral.sh/uv/) (Recommended)**

```bash
# Install uv if you don't have it
curl -LsSf https://astral.sh/uv/install.sh | sh
# or: brew install uv

# Clone and run the token extractor
git clone https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor.git
cd Xiaomi-cloud-tokens-extractor
uv run --with-requirements requirements.txt python token_extractor.py
```

**Windows:** Download the executable from
[releases](https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor/releases).

You'll be prompted for your Mi Home account credentials and region. The output shows all devices:

```
Name: Living Room Light
Model: yeelink.light.color3
Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
IP: 192.168.1.50
```

### 2. Test Device Connectivity (Optional)

Verify your device token works before configuring:

```bash
# Clone the repo and run the test script
git clone https://github.com/raisedadead/homebridge-xiaomi-home.git
cd homebridge-xiaomi-home
npm install
node scripts/test-device.mjs <ip> <token>
```

This tests connectivity, verifies the token, and shows current device state.

### 3. Configure the Plugin

Add to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "XiaomiHome",
      "name": "Xiaomi Home",
      "pollingInterval": 15,
      "devices": [
        {
          "name": "Living Room Light",
          "ip": "192.168.1.50",
          "token": "your32characterhextokenhere00",
          "model": "yeelink.light.color3"
        }
      ]
    }
  ]
}
```

### 4. Restart Homebridge

Your devices should now appear in the Home app!

## Configuration Options

| Option            | Type     | Default         | Description                       |
| ----------------- | -------- | --------------- | --------------------------------- |
| `platform`        | `string` | **Required**    | Must be `"XiaomiHome"`            |
| `name`            | `string` | `"Xiaomi Home"` | Display name for the platform     |
| `pollingInterval` | `number` | `15`            | State polling interval in seconds |
| `devices`         | `array`  | **Required**    | Array of device configurations    |

### Device Configuration

| Option  | Type     | Description                                        |
| ------- | -------- | -------------------------------------------------- |
| `name`  | `string` | Display name for the device in HomeKit             |
| `ip`    | `string` | Device IP address (use static IP/DHCP reservation) |
| `token` | `string` | 32-character hex device token                      |
| `model` | `string` | Device model identifier (see supported devices)    |

## Setup Requirements

### Static IP Addresses

Devices must have stable IP addresses. Set up DHCP reservation on your router:

1. **Find the device MAC address** – Mi Home app > Device > Settings > Network Info
2. **Create DHCP reservation** – Router admin > DHCP settings > Add reservation
3. **Apply** – Power cycle the device and verify with `ping`

## Troubleshooting

### Device not responding

1. Verify device is on the same network subnet as Homebridge
2. Check IP address hasn't changed (use DHCP reservation)
3. Verify token is correct (re-extract if needed)
4. Ensure no firewall blocking UDP port 54321

### Token extraction fails

- Ensure correct Mi Home account region
- Leave server empty to check all regions
- Use QR code login if password login fails

### "externally-managed-environment" error on macOS/Linux

Modern Python installations block system-wide pip installs (PEP 668). Use [uv](https://docs.astral.sh/uv/) instead:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then follow the token extraction instructions above.

### Device shows "No Response" in Home app

- Check Homebridge logs for connection errors
- Verify device is powered on and connected to WiFi
- Try restarting both device and Homebridge

## Contributing

Contributions are welcome! For bugs and feature requests, please [open an issue](https://github.com/raisedadead/homebridge-xiaomi-home/issues).

## License

ISC License - see [LICENSE](./LICENSE) file for details.
