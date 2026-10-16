import type { Conversation, MentionOption } from '@/features/messenger/types';

export function mentionOptionsFor(
    conversation: Conversation | null,
    currentUserId: number,
): MentionOption[] {
    if (!conversation) {
        return [];
    }

    return [
        ...(conversation.permissions.can_mention_everyone
            ? [
                  {
                      id: 'everyone' as const,
                      label: 'Everyone',
                      token: '@everyone',
                      description: 'Notify everyone in this chat',
                  },
              ]
            : []),
        ...conversation.participants
            .filter((participant) => participant.id !== currentUserId)
            .map((participant) => ({
                id: participant.id,
                label: participant.name,
                token: `@${mentionToken(participant.name)}`,
                description: participant.school_role,
            })),
    ];
}

export function mentionToken(name: string) {
    return name.trim().replace(/\s+/g, '');
}

export function mentionRangeAtCursor(text: string, cursor: number) {
    const beforeCursor = text.slice(0, cursor);
    const match = beforeCursor.match(/(^|\s)@([A-Za-z0-9._-]*)$/);

    if (!match || match.index === undefined) {
        return null;
    }

    const start = match.index + match[1].length;

    return {
        start,
        end: cursor,
        query: match[2] ?? '',
    };
}

export function mentionQueryAtCursor(text: string, cursor: number) {
    return mentionRangeAtCursor(text, cursor)?.query ?? null;
}

export function mentionifyText(text: string) {
    const parts: Array<
        | {
              type: 'text';
              text: string;
          }
        | {
              type: 'mention';
              text: string;
          }
    > = [];
    const pattern = /(^|\s)(@everyone|@[A-Za-z0-9._-]+)/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        const mention = match[2];
        const start = match.index + match[1].length;

        if (start > lastIndex) {
            parts.push({
                type: 'text',
                text: text.slice(lastIndex, start),
            });
        }

        parts.push({
            type: 'mention',
            text: mention,
        });

        lastIndex = start + mention.length;
    }

    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            text: text.slice(lastIndex),
        });
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, text }];
}

export function linkifyText(text: string) {
    const parts: Array<
        | {
              type: 'text';
              text: string;
          }
        | {
              type: 'link';
              href: string;
              text: string;
          }
    > = [];
    const pattern = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        const [rawUrl] = match;
        const start = match.index;

        if (start > lastIndex) {
            parts.push({
                type: 'text',
                text: text.slice(lastIndex, start),
            });
        }

        const trailingPunctuation = rawUrl.match(/[.,);\]]+$/)?.[0] ?? '';
        const cleanUrl = trailingPunctuation
            ? rawUrl.slice(0, -trailingPunctuation.length)
            : rawUrl;

        parts.push({
            type: 'link',
            href: cleanUrl.startsWith('http')
                ? cleanUrl
                : `https://${cleanUrl}`,
            text: cleanUrl,
        });

        if (trailingPunctuation) {
            parts.push({
                type: 'text',
                text: trailingPunctuation,
            });
        }

        lastIndex = start + rawUrl.length;
    }

    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            text: text.slice(lastIndex),
        });
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, text }];
}
