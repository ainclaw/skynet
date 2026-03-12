import dotenv from 'dotenv';
dotenv.config();

export interface EagleClawConfig {
  SKYNET_WS_URL: string;
  OPENCLAW_API_URL: string;
  PRIVATE_KEY: string;
}

const defaults: EagleClawConfig = {
  SKYNET_WS_URL: 'ws://localhost:8080',
  OPENCLAW_API_URL: 'http://localhost:3000',
  PRIVATE_KEY: '',
};

export let CONFIG: EagleClawConfig = {
  SKYNET_WS_URL: process.env.SKYNET_WS_URL || defaults.SKYNET_WS_URL,
  OPENCLAW_API_URL: process.env.OPENCLAW_API_URL || defaults.OPENCLAW_API_URL,
  PRIVATE_KEY: process.env.PRIVATE_KEY || defaults.PRIVATE_KEY,
};

export function updateConfig(overrides: Partial<EagleClawConfig>) {
  CONFIG = { ...CONFIG, ...overrides };
}
