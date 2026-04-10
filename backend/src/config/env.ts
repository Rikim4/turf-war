import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  JWT_SECRET: requireEnv('JWT_SECRET'),
  STRAVA_CLIENT_ID: requireEnv('STRAVA_CLIENT_ID'),
  STRAVA_CLIENT_SECRET: requireEnv('STRAVA_CLIENT_SECRET'),
  STRAVA_REDIRECT_URI: requireEnv('STRAVA_REDIRECT_URI'),
  STRAVA_WEBHOOK_VERIFY_TOKEN: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'default_verify_token',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};
