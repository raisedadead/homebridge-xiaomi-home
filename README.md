# Homebridge Xiaomi Home

Homebridge plugin for Xiaomi/Yeelight smart home devices using local network control via the miio protocol.

## Supported Devices

| Model                   | Name                    | Capabilities                              |
| ----------------------- | ----------------------- | ----------------------------------------- |
| `yeelink.light.color3`  | Yeelight Color Bulb 3   | Power, Brightness, Color Temperature, RGB |
| `yeelink.light.bslamp2` | Yeelight Bedside Lamp 2 | Power, Brightness, Color Temperature, RGB |

## Installation

```bash
npm install -g homebridge-xiaomi-home
```

Or search for "Xiaomi Home" in the Homebridge UI.

## Configuration

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

## Setup Requirements

### 1. Obtaining Device Tokens

Device tokens are required for local control. Use the python-miio CLI tool:

**Using uv (recommended):**

```bash
uvx --from python-miio miiocli cloud list
```

**Using pip:**

```bash
pip install python-miio
miiocli cloud list
```

The command will prompt for:

- **Username**: Your Mi Home account email
- **Password**: Your account password
- **Locale**: Your region (`cn`, `de`, `us`, `ru`, `sg`, `i2`, or `all`)

Output shows all devices with their tokens:

```
Name: Living Room Light
Model: yeelink.light.color3
Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
IP: 192.168.1.50
```

**Alternative: Xiaomi Cloud Token Extractor**

If python-miio doesn't work, use the standalone extractor:

- **Windows**: Download `token_extractor.exe` from
  [releases](https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor/releases)
- **Linux/macOS**:
  ```bash
  bash <(curl -L https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor/raw/master/run.sh)
  ```

### 2. Setting Up Static IP Addresses

Devices must have stable IP addresses. Use DHCP reservation on your router:

1. **Find the device MAC address**:
   - Open Mi Home app
   - Tap the device → Settings (three dots) → Network Info
   - Note the MAC address

2. **Create DHCP reservation**:
   - Log into your router admin panel
   - Find DHCP settings / Address Reservation
   - Add reservation: MAC address → desired IP (e.g., `192.168.1.50`)
   - Save settings

3. **Apply the reservation**:
   - Power cycle the device (unplug and replug)
   - Verify with `ping 192.168.1.50`

### 3. Finding the Device Model

The model identifier is shown in:

- The python-miio output above
- Mi Home app → Device → Settings → About → Model

## Troubleshooting

### Device not responding

1. Verify the device is on the same network subnet as Homebridge
2. Check the IP address hasn't changed (use DHCP reservation)
3. Verify the token is correct (re-extract if needed)

### Token extraction fails

- Ensure you're using the correct Mi Home account region
- Try the `all` locale option to search all regions
- Check if 2FA is enabled (may need to disable temporarily)

## License

MIT
