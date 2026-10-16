import { Check, Forward, Search, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Avatar } from '@/features/messenger/components/common';
import { conversationPreview } from '@/features/messenger/lib/conversations';
import { messagePreview } from '@/features/messenger/lib/messages';
import type {
    Conversation,
    MessengerMessage,
} from '@/features/messenger/types';

export function ForwardMessageDialog({
    conversations,
    forwarding,
    message,
    onClose,
    onForward,
}: {
    conversations: Conversation[];
    forwarding: boolean;
    message: MessengerMessage;
    onClose: () => void;
    onForward: (
        message: MessengerMessage,
        conversationIds: number[],
    ) => Promise<boolean>;
}) {
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const filteredConversations = conversations.filter((conversation) =>
        conversation.display_name.toLowerCase().includes(query.toLowerCase()),
    );
    const canSubmit = selectedIds.length > 0 && !forwarding;

    const toggleConversation = (conversationId: number) => {
        setSelectedIds((ids) =>
            ids.includes(conversationId)
                ? ids.filter((id) => id !== conversationId)
                : [...ids, conversationId],
        );
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        await onForward(message, selectedIds);
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-6 backdrop-blur-sm">
            <form
                className="flex max-h-[min(680px,calc(100vh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-base font-semibold text-foreground">
                        Forward message
                    </h2>
                    <button
                        aria-label="Close"
                        className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <div className="shrink-0 space-y-3 border-b border-border p-4">
                    <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <span className="line-clamp-2">
                            {messagePreview(message)}
                        </span>
                    </div>
                    <label className="flex h-11 items-center gap-2 rounded-xl bg-muted px-3 text-muted-foreground">
                        <Search className="size-4" />
                        <input
                            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search chats"
                            type="search"
                            value={query}
                        />
                    </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {filteredConversations.length > 0 ? (
                        filteredConversations.map((conversation) => {
                            const selected = selectedIds.includes(
                                conversation.id,
                            );

                            return (
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-muted/40"
                                    key={conversation.id}
                                    onClick={() =>
                                        toggleConversation(conversation.id)
                                    }
                                    type="button"
                                >
                                    <Avatar
                                        label={conversation.display_name}
                                        photoUrl={conversation.photo_url}
                                        type={conversation.type}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-foreground">
                                            {conversation.display_name}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {conversationPreview(
                                                conversation.latest_message,
                                            )}
                                        </span>
                                    </span>
                                    <span
                                        className={`grid size-6 shrink-0 place-items-center rounded-full border ${
                                            selected
                                                ? 'border-brand bg-brand-solid text-brand-foreground'
                                                : 'border-border text-transparent'
                                        }`}
                                    >
                                        <Check className="size-4" />
                                    </span>
                                </button>
                            );
                        })
                    ) : (
                        <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                                <Forward className="size-6" />
                            </span>
                            <h3 className="mt-3 text-sm font-semibold text-foreground">
                                No chats found
                            </h3>
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-border p-4">
                    <button
                        className="h-11 w-full rounded-xl bg-brand-solid px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                        disabled={!canSubmit}
                        type="submit"
                    >
                        {forwarding ? 'Forwarding...' : 'Forward'}
                    </button>
                </div>
            </form>
        </div>
    );
}
