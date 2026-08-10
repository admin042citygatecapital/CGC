/**
 * chatbotStore.ts — Persistent chatbot configuration
 */
import fs from 'node:fs';
import path from 'node:path';
import { privateSubdirectory } from './storagePaths.js';

const STORE_PATH = privateSubdirectory('cms/chatbot.json');

export interface ChatbotConfig {
  widgetEnabled: boolean;
  widgetPosition: string;
  widgetColor: string;
  widgetGreeting: string;
  widgetName: string;
  widgetAvatar: string;
  provider: string;
  providerKey: string;
  providerWorkspaceId: string;
  aiEnabled: boolean;
  aiModel: string;
  aiSystemPrompt: string;
  aiEscalationKeywords: string;
  liveSupportEnabled: boolean;
  liveSupportHours: string;
  liveSupportEmail: string;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  telegramEnabled: boolean;
  telegramUsername: string;
  escalationEnabled: boolean;
  escalationEmail: string;
  escalationThreshold: string;
}

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readChatbotConfig(): Partial<ChatbotConfig> {
  try {
    ensureDir();
    if (!fs.existsSync(STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function writeChatbotConfig(config: Partial<ChatbotConfig>): void {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(config, null, 2));
}
