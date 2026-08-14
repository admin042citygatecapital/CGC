/**
 * chatbotStore.ts — Persistent chatbot configuration
 */
import { privateSubdirectory } from './storagePaths.js';
import { readConfigDocument, writeConfigDocument } from './durableConfigDocument.js';

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

export async function readChatbotConfig(): Promise<Partial<ChatbotConfig>> {
  return readConfigDocument<Partial<ChatbotConfig>>('chatbot_settings', STORE_PATH, {});
}

export async function writeChatbotConfig(config: Partial<ChatbotConfig>, updatedBy = 'admin'): Promise<void> {
  await writeConfigDocument('chatbot_settings', STORE_PATH, config, updatedBy);
}
