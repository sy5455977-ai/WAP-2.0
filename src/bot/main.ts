import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
import { memoryManager } from './memory.js';
import { AIEngine } from './ai_engine.js';

export function setupTelegramBot() {
  if (!config.TELEGRAM_BOT_TOKEN) {
    console.log('[Telegram Bot] Skipping initialization, no token provided.');
    return;
  }

  const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
  console.log('[Telegram Bot] Started successfully!');

  // Handle /start
  bot.onText(/^\/start$/, (msg) => {
    const chatId = msg.chat.id;
    memoryManager.clearMemory(chatId);
    bot.sendMessage(chatId, "Hello! I am your AI Assistant powered by Pollinations AI.\n\nType /help to see what I can do for you.");
  });

  // Handle /help
  bot.onText(/^\/help$/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
**Available Commands:**
/start - Welcome message
/help - Show commands
/image <prompt> - Generate an image
/voice - Toggle voice response mode
/reset - Clear conversation memory
    
You can also just send a message normally to chat with me!`;
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  });

  // Handle /reset
  bot.onText(/^\/reset$/, (msg) => {
    const chatId = msg.chat.id;
    memoryManager.clearMemory(chatId);
    bot.sendMessage(chatId, "🧹 Conversation memory cleared! Let's start fresh.");
  });

  // Handle /voice
  bot.onText(/^\/voice$/, (msg) => {
    const chatId = msg.chat.id;
    const currentMode = memoryManager.getVoiceMode(chatId);
    const newMode = !currentMode;
    memoryManager.setVoiceMode(chatId, newMode);
    bot.sendMessage(chatId, newMode ? "🎙️ Voice mode *ON*. I will reply with audio!" : "🔈 Voice mode *OFF*. I will reply with text.", { parse_mode: 'Markdown' });
  });

  // Handle /image
  bot.onText(/^\/image(?:\s+(.*))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const prompt = match ? match[1] : null;

    if (!prompt) {
      bot.sendMessage(chatId, "Please provide a prompt. Example: `/image cyberpunk city at night`", { parse_mode: 'Markdown' });
      return;
    }

    try {
      bot.sendChatAction(chatId, 'upload_photo');
      const imageUrl = AIEngine.generateImageURL(prompt);
      await bot.sendPhoto(chatId, imageUrl, { caption: `🎨 Here is your image for: "${prompt}"` });
    } catch (error) {
      console.error('[Bot Error] Image Gen Failed:', error);
      bot.sendMessage(chatId, "Sorry, I couldn't generate the image. Please try again later.");
    }
  });

  // Handle normal text messages (excluding commands)
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands or empty text
    if (!text || text.startsWith('/')) return;

    try {
      // 1. Send typing action
      const voiceMode = memoryManager.getVoiceMode(chatId);
      bot.sendChatAction(chatId, voiceMode ? 'record_voice' : 'typing');

      // 2. Add user message to memory
      memoryManager.addMessage(chatId, 'user', text);

      // 3. Get Context and request AI response
      const context = memoryManager.getContext(chatId);
      let responseText = await AIEngine.generateText(context);

      // Add AI response to memory
      memoryManager.addMessage(chatId, 'assistant', responseText);

      // 4. Send response
      if (voiceMode) {
        // Voice mode active, generate short TTS and send
        const audioUrl = AIEngine.generateVoiceURL(responseText);
        await bot.sendVoice(chatId, audioUrl, { caption: responseText });
      } else {
        // Standard text response
        await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
      }

    } catch (error) {
      console.error('[Bot Error] Chat Failed:', error);
      bot.sendMessage(chatId, "Oops! Something went wrong on my end. Please try again.");
    }
  });

  bot.on('polling_error', (error) => {
    console.error('[Telegram Polling Error]', error.message);
  });
}
