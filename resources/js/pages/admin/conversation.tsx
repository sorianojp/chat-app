import { Head } from '@inertiajs/react';
import { Paperclip } from 'lucide-react';
import {
    AdminShell,
    Avatar,
    Pagination,
    StatusBadge,
} from '@/features/admin/components';
import type {
    AdminConversation,
    AdminMessage,
    AdminUser,
    Paginated,
} from '@/features/admin/types';
import { formatFileSize, formatTime } from '@/features/messenger/lib/format';

type Props = {
    conversation: AdminConversation & { participants: AdminUser[] };
    messages: Paginated<AdminMessage>;
};

export default function AdminConversation({ conversation, messages }: Props) {
    // Newest page first from the server; show each page oldest-to-newest.
    const ordered = [...messages.data].reverse();

    return (
        <>
            <Head title={`Admin · ${conversation.title}`} />
            <AdminShell
                back={{ href: '/admin/users', label: 'All users' }}
                description={
                    <>
                        <span className="capitalize">{conversation.type}</span>
                        {conversation.school && ` · ${conversation.school}`} ·
                        Read-only view. Opening this conversation was recorded
                        in the admin access log.
                    </>
                }
                title={conversation.title}
            >
                <div className="flex flex-wrap gap-2">
                    {conversation.participants.map((participant) => (
                        <span
                            className="inline-flex items-center gap-2 rounded-full bg-card py-1 pr-1 pl-3 text-sm text-foreground"
                            key={participant.id}
                        >
                            {participant.name}
                            <StatusBadge user={participant} />
                        </span>
                    ))}
                </div>

                <Pagination page={messages} />

                <div className="flex flex-col gap-1 rounded-card bg-card p-2">
                    {ordered.length === 0 ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            No messages.
                        </p>
                    ) : (
                        ordered.map((message) => (
                            <div
                                className="flex gap-3 rounded-xl px-3 py-2"
                                key={message.id}
                            >
                                <Avatar name={message.sender?.name ?? '?'} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline gap-2">
                                        <span className="text-sm font-semibold text-foreground">
                                            {message.sender?.name ?? 'System'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatTime(message.created_at)}
                                        </span>
                                        {message.unsent && (
                                            <span className="rounded bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                                                Unsent
                                            </span>
                                        )}
                                        {message.deleted && (
                                            <span className="rounded bg-rose-500/15 px-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                                                Deleted
                                            </span>
                                        )}
                                        {message.type !== 'text' && (
                                            <span className="rounded bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground capitalize">
                                                {message.type.replace('_', ' ')}
                                            </span>
                                        )}
                                    </div>
                                    {message.body && (
                                        <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-foreground">
                                            {message.body}
                                        </p>
                                    )}
                                    {message.attachments.map((attachment) => (
                                        <p
                                            className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
                                            key={attachment.id}
                                        >
                                            <Paperclip className="size-3.5" />
                                            {attachment.name} (
                                            {formatFileSize(attachment.size)})
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Pagination page={messages} />
            </AdminShell>
        </>
    );
}

AdminConversation.layout = {
    breadcrumbs: [{ title: 'Admin', href: '/admin/users' }],
};
