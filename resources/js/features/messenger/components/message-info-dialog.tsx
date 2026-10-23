import { X } from 'lucide-react';
import { Avatar } from '@/features/messenger/components/common';
import { formatTime } from '@/features/messenger/lib/format';
import {
    messagePreview,
    messageReceipts,
} from '@/features/messenger/lib/messages';
import type {
    Conversation,
    MessengerMessage,
} from '@/features/messenger/types';

/** "Seen by": who has read, received, or not yet received your message. */
export function MessageInfoDialog({
    conversation,
    message,
    onClose,
}: {
    conversation: Conversation;
    message: MessengerMessage;
    onClose: () => void;
}) {
    const { seen, delivered, pending } = messageReceipts(message, conversation);
    const sections: {
        title: string;
        people: { id: number; name: string; at?: string }[];
    }[] = [
        { title: 'Seen by', people: seen },
        { title: 'Delivered to', people: delivered },
        { title: 'Not delivered yet', people: pending },
    ].filter((section) => section.people.length > 0);

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-6 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                aria-labelledby="message-info-title"
                aria-modal="true"
                className="flex max-h-[min(680px,calc(100vh-3rem))] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
            >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                    <h2
                        className="text-base font-semibold text-foreground"
                        id="message-info-title"
                    >
                        Message info
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
                <p className="shrink-0 truncate border-b border-border px-4 py-3 text-sm text-muted-foreground">
                    {messagePreview(message)}
                </p>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {sections.map((section) => (
                        <section className="py-2" key={section.title}>
                            <h3 className="px-3 pb-1 text-xs font-semibold text-muted-foreground">
                                {section.title} · {section.people.length}
                            </h3>
                            {section.people.map((person) => (
                                <div
                                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                                    key={person.id}
                                >
                                    <Avatar
                                        label={person.name}
                                        photoUrl={null}
                                        type="direct"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                                        {person.name}
                                    </span>
                                    {person.at && (
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {formatTime(person.at)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
