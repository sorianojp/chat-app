export function loadConversationDrafts(
    storageKey: string,
): Record<number, string> {
    try {
        const saved: unknown = JSON.parse(
            localStorage.getItem(storageKey) ?? '{}',
        );

        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(saved).filter(
                ([conversationId, body]) =>
                    Number(conversationId) > 0 &&
                    typeof body === 'string' &&
                    body.trim().length > 0 &&
                    body.length <= 5000,
            ),
        ) as Record<number, string>;
    } catch {
        return {};
    }
}

export function saveConversationDrafts(
    storageKey: string,
    drafts: Record<number, string>,
) {
    try {
        if (Object.keys(drafts).length === 0) {
            localStorage.removeItem(storageKey);
        } else {
            localStorage.setItem(storageKey, JSON.stringify(drafts));
        }
    } catch {
        // Private browsing or a full storage quota should not block typing.
    }
}

const DETAILS_OPEN_KEY = 'uhoo:chat-details-open';

/** Whether the chat details panel was left open (closed by default). */
export function loadDetailsPanelOpen() {
    try {
        return (
            typeof window !== 'undefined' &&
            window.localStorage.getItem(DETAILS_OPEN_KEY) === '1'
        );
    } catch {
        return false;
    }
}

export function saveDetailsPanelOpen(open: boolean) {
    try {
        if (open) {
            window.localStorage.setItem(DETAILS_OPEN_KEY, '1');
        } else {
            window.localStorage.removeItem(DETAILS_OPEN_KEY);
        }
    } catch {
        // Private browsing or blocked storage: the choice just won't persist.
    }
}
