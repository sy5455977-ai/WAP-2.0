import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Use the token provided by user as default for easy deployment, 
  // but allow override via environment variables.
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8337001421:AAE0pq36icT0jDx2AwsEfq7umqNkN7tUVDA',
  POLLINATIONS_TEXT_API: 'https://text.pollinations.ai/',
  POLLINATIONS_IMAGE_API: 'https://image.pollinations.ai/prompt/',
  POLLINATIONS_VOICE_API: 'https://gen.pollinations.ai/audio/',
  MAX_MEMORY_LENGTH: 10,
};
