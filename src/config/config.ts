import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config();

interface Config {
  PORT: number;
  NODE_ENV: string;
  CORS_ORIGINS: string[];
  RENDER_CONFIG_PATH: string;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['*'],
  RENDER_CONFIG_PATH: process.env.RENDER_CONFIG_PATH || './render-config.json',
};

// const __dirname = path.dirname(fileURLToPath(import.meta.url));

const renderConfig: Record<string, { url: string; keys: string[] | null }> =
  JSON.parse(fs.readFileSync(path.join(config.RENDER_CONFIG_PATH), 'utf8'));

export { config, renderConfig };
