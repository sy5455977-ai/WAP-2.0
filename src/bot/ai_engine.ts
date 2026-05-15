import { config } from './config.js';
import { Message } from './memory.js';

export class AIEngine {
  static async generateText(messages: Message[]): Promise<string> {
    try {
      const response = await fetch(`${config.POLLINATIONS_TEXT_API}?model=openai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           messages,
           seed: Math.floor(Math.random() * 1000000) 
        }),
      });

      if (!response.ok) {
        throw new Error('AI Engine returned an error');
      }

      return await response.text();
    } catch (error) {
      console.error('[AI Engine Text Error]', error);
      throw error;
    }
  }

  static generateImageURL(prompt: string): string {
    const seed = Math.floor(Math.random() * 1000000);
    // Use turbo model for faster response
    return `${config.POLLINATIONS_IMAGE_API}${encodeURIComponent(prompt)}?nologo=true&seed=${seed}&model=turbo&enhance=false&width=768&height=768`;
  }

  static generateVoiceURL(text: string): string {
    const cleanText = text.replace(/[*_~`#*[\]()]/g, '').trim();
    return `${config.POLLINATIONS_VOICE_API}${encodeURIComponent(cleanText)}?voice=nova`;
  }
}
