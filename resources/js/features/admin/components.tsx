import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AdminUser, Paginated } from '@/features/admin/types';
import {
    formatRelativeLastSeen,
    initials,
} from '@/features/messenger/lib/format';

export function AdminShell({
    title,
    description,
    back,
    children,
}: {
    title: string;
    description?: ReactNode;
    back?: { href: string; label: string };
    children: ReactNode;
}) {
    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
            {back && (
                <Link
                    className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    href={back.href}
                >
                    <ChevronLeft className="size-4" />
                    {back.label}
                </Link>
            )}
            <div>
                <h1 className="text-xl font-semibold text-foreground">
                    {title}
                </h1>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {children}
        </div>
    );
}

export function StatusBadge({ user }: { user: AdminUser }) {
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                user.online
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
            }`}
        >
            <span
                className={`size-2 rounded-full ${
                    user.online ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                }`}
            />
            {user.online ? 'Online' : 'Offline'}
        </span>
    );
}

export function lastSeenLabel(user: AdminUser) {
    if (user.online) {
        return 'Active now';
    }

    return user.last_seen_at
        ? `Last seen ${formatRelativeLastSeen(user.last_seen_at)}`
        : 'Never seen';
}

export function Avatar({ name }: { name: string }) {
    return (
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">
            {initials(name)}
        </span>
    );
}

export function Pagination<T>({ page }: { page: Paginated<T> }) {
    if (page.last_page <= 1) {
        return null;
    }

    const linkClass =
        'inline-flex h-9 items-center gap-1 rounded-xl bg-muted px-3 text-sm font-medium text-foreground transition hover:bg-muted/70';

    return (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
                Page {page.current_page} of {page.last_page}
            </span>
            <div className="flex gap-2">
                {page.prev_page_url && (
                    <Link
                        className={linkClass}
                        href={page.prev_page_url}
                        preserveScroll
                    >
                        <ChevronLeft className="size-4" /> Previous
                    </Link>
                )}
                {page.next_page_url && (
                    <Link
                        className={linkClass}
                        href={page.next_page_url}
                        preserveScroll
                    >
                        Next <ChevronRight className="size-4" />
                    </Link>
                )}
            </div>
        </div>
    );
}
