#!/usr/bin/env node

/**
 * Debug script to test device connectivity using actual plugin code
 * Usage: node scripts/debug.mjs
 *
 * Requires .env file with device configs (see .env.example)
 */

import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

if (!existsSync(envPath)) {
  console.error('Error: .env file not found');
  console.error('Create .env with device configs (see .env.example)');
  process.exit(1);
}

config({ path: envPath, quiet: true });
const env = process.env;

// Parse devices
const devices = [];
for (let i = 1; i <= 10; i++) {
  const name = env[`DEVICE_${i}_NAME`];
  const ip = env[`DEVICE_${i}_IP`];
  const token = env[`DEVICE_${i}_TOKEN`];
  const model = env[`DEVICE_${i}_MODEL`];
  if (ip && token && model) {
    devices.push({ name: name || `Device ${i}`, ip, token, model });
  }
}

if (devices.length === 0) {
  console.error('Error: No devices configured in .env');
  process.exit(1);
}

// Dynamic import of CommonJS module
const { createDevice } = await import('../dist/devices/index.js');

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.log('[WARN]', ...args),
  error: (...args) => console.log('[ERROR]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args),
};

async function testDevice(config) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Testing: ${config.name}`);
  console.log(`  IP: ${config.ip} | Model: ${config.model}`);
  console.log('─'.repeat(50));

  try {
    const device = createDevice(config.model, config.ip, config.token, logger);
    if (!device) {
      console.log('✗ Unknown model');
      return false;
    }

    await device.connect();
    const state = await device.getState();
    console.log('State:', JSON.stringify(state, null, 2));
    await device.disconnect();
    console.log('✓ Success');
    return true;
  } catch (error) {
    console.log(`✗ Failed: ${error.message}`);
    return false;
  }
}

console.log(`Homebridge Xiaomi Home - Debug\nFound ${devices.length} device(s)\n`);

let passed = 0;
for (const device of devices) {
  if (await testDevice(device)) passed++;
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed}/${devices.length} passed`);
process.exit(passed === devices.length ? 0 : 1);
