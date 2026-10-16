import type { SharedContent } from '@/features/messenger/types';

export const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '🙏', '✅'];

export const TYPING_IDLE_MS = 3000;

export const TYPING_WHISPER_INTERVAL_MS = 1200;

export const PRESENCE_HEARTBEAT_INTERVAL_MS = 60_000;

export const EMPTY_SHARED_CONTENT: SharedContent = {
    media: [],
    files: [],
    links: [],
};
