#!/usr/bin/env node

/**
 * Test device connectivity and token validity
 * Usage: node scripts/test-device.mjs <ip> <token>
 */

import miio from 'miio';

const [ip, token] = process.argv.slice(2);

if (!ip || !token) {
  console.log(`
Xiaomi Device Tester

Usage: node scripts/test-device.mjs <ip> <token>

Example:
  node scripts/test-device.mjs 192.168.1.50 your32characterhextokenhere00
`);
  process.exit(1);
}

if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
  console.error('Error: Invalid IP address format');
  process.exit(1);
}

if (!/^[a-fA-F0-9]{32}$/.test(token)) {
  console.error('Error: Token must be 32 hexadecimal characters');
  process.exit(1);
}

console.log(`\nTesting device at ${ip}...`);
console.log('─'.repeat(40));

try {
  const device = await miio.device({ address: ip, token });
  console.log('✓ Connected\n');

  const props = await device.call('get_prop', [
    'power',
    'bright',
    'ct',
    'rgb',
    'hue',
    'sat',
    'color_mode',
  ]);

  console.log('Device State:');
  console.log('─'.repeat(40));
  console.log(`  Power:       ${props[0]}`);
  console.log(`  Brightness:  ${props[1]}%`);
  console.log(`  Color Temp:  ${props[2]}K`);
  console.log(`  RGB:         ${props[3]}`);
  console.log(`  Hue:         ${props[4]}°`);
  console.log(`  Saturation:  ${props[5]}%`);
  console.log(
    `  Color Mode:  ${props[6] === '1' ? 'Color Temp' : props[6] === '2' ? 'RGB' : 'HSV'}`
  );

  console.log('\n✓ Device working\n');
  console.log('Sample config:');
  console.log('─'.repeat(40));
  console.log(JSON.stringify({ name: 'My Light', ip, token, model: 'yeelink.light.color3' }, null, 2));

  device.destroy();
} catch (error) {
  console.error('\n✗ Connection failed\n');

  if (error.code === 'timeout') {
    console.error('Timeout - check IP, network, and UDP port 54321');
  } else if (error.message?.includes('token')) {
    console.error('Invalid token - re-extract from Mi Home cloud');
  } else {
    console.error('Error:', error.message || error);
  }
  process.exit(1);
}
