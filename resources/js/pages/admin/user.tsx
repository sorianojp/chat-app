import { Head, Link } from '@inertiajs/react';
import { ChevronRight, MessagesSquare } from 'lucide-react';
import {
    AdminShell,
    lastSeenLabel,
    Pagination,
    StatusBadge,
} from '@/features/admin/components';
import type {
    AdminConversation,
    AdminUser,
    Paginated,
} from '@/features/admin/types';
import { formatTime } from '@/features/messenger/lib/format';

type Props = {
    user: AdminUser;
    conversations: Paginated<AdminConversation>;
};

export default function AdminUser({ user, conversations }: Props) {
    return (
        <>
            <Head title={`Admin · ${user.name}`} />
            <AdminShell
                back={{ href: '/admin/users', label: 'All users' }}
                description={
                    <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge user={user} />
                        <span>{lastSeenLabel(user)}</span>
                        <span>·</span>
                        <span>{user.email}</span>
                        <span>·</span>
                        <span className="capitalize">
                            {user.school_role.replace('_', ' ')}
                        </span>
                        {user.schools && user.schools.length > 0 && (
                            <>
                                <span>·</span>
                                <span>{user.schools.join(', ')}</span>
                            </>
                        )}
                    </span>
                }
                title={user.name}
            >
                <h2 className="text-sm font-semibold text-foreground">
                    Conversations ({conversations.total})
                </h2>
                <div className="overflow-hidden rounded-card bg-card">
                    {conversations.data.length === 0 ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            No conversations yet.
                        </p>
                    ) : (
                        conversations.data.map((conversation) => (
                            <Link
                                className="flex items-center gap-3 border-b border-border/50 px-4 py-3 transition last:border-b-0 hover:bg-muted/40"
                                href={`/admin/conversations/${conversation.id}`}
                                key={conversation.id}
                            >
                                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                                    <MessagesSquare className="size-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-foreground">
                                        {conversation.title}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground capitalize">
                                        {conversation.type} ·{' '}
                                        {conversation.participants_count} people
                                        · {conversation.messages_count ?? 0}{' '}
                                        messages
                                        {conversation.school &&
                                            ` · ${conversation.school}`}
                                    </span>
                                </span>
                                <span className="hidden text-xs text-muted-foreground sm:block">
                                    {formatTime(conversation.last_message_at)}
                                </span>
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                            </Link>
                        ))
                    )}
                </div>
                <Pagination page={conversations} />
            </AdminShell>
        </>
    );
}

AdminUser.layout = {
    breadcrumbs: [{ title: 'Admin', href: '/admin/users' }],
};
