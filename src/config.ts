import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv-safe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requireProcessEnv = (name: string): string => {
  if (!process.env[name]) {
    throw new Error('You must set the ' + name + ' environment variable');
  }
  return process.env[name] as string;
};

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({
    allowEmptyValues: true,
    path: path.join(__dirname, '../.env'),
    example: path.join(__dirname, '../.env.example')
  });
}

interface Config {
  discordToken: string;
  env: string;
}

const config: Config = {
  discordToken: requireProcessEnv('DISCORD_TOKEN'),
  env: process.env.NODE_ENV || 'development'
};

export default config;