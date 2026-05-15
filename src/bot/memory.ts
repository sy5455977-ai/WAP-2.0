import { config } from './config.js';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

class UserMemory {
  private memory: Map<number, Message[]> = new Map();
  private voiceSwitch: Map<number, boolean> = new Map();

  // Add a message to user's memory, maintaining context size
  addMessage(userId: number, role: 'user' | 'assistant', content: string) {
    if (!this.memory.has(userId)) {
      this.memory.set(userId, []);
    }

    const userHistory = this.memory.get(userId)!;
    userHistory.push({ role, content });

    // Ensure we only keep the last MAX_MEMORY_LENGTH messages
    if (userHistory.length > config.MAX_MEMORY_LENGTH) {
       // remove the oldest message (at index 0)
       userHistory.shift();
    }
    
    this.memory.set(userId, userHistory);
  }

  // Get the full formatted conversation for the AI
  getContext(userId: number): Message[] {
    const history = this.memory.get(userId) || [];
    return [
      { role: 'system', content: 'You are a helpful and friendly conversational AI assistant on Telegram. Keep responses short but informative and human-like.' },
      ...history
    ];
  }

  // Clear user conversation
  clearMemory(userId: number) {
    this.memory.set(userId, []);
  }

  // Toggle voice mode
  setVoiceMode(userId: number, enabled: boolean) {
    this.voiceSwitch.set(userId, enabled);
  }

  getVoiceMode(userId: number): boolean {
    return this.voiceSwitch.get(userId) || false;
  }
}

export const memoryManager = new UserMemory();
