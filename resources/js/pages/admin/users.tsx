import { Head, Link, router } from '@inertiajs/react';
import { ChevronRight, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    AdminShell,
    Avatar,
    lastSeenLabel,
    Pagination,
    StatusBadge,
} from '@/features/admin/components';
import type { AdminUser, Paginated } from '@/features/admin/types';

type Status = 'all' | 'online' | 'offline';

type Props = {
    users: Paginated<AdminUser>;
    filters: { search: string; status: Status };
    counts: { total: number; online: number };
};

export default function AdminUsers({ users, filters, counts }: Props) {
    const [search, setSearch] = useState(filters.search);
    const debounce = useRef<number | undefined>(undefined);

    const visit = (next: { search?: string; status?: Status }) => {
        router.get(
            '/admin/users',
            {
                search: (next.search ?? search) || undefined,
                status:
                    (next.status ?? filters.status) === 'all'
                        ? undefined
                        : (next.status ?? filters.status),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    // Keep online/offline current while the page stays open.
    useEffect(() => {
        const interval = window.setInterval(
            () => router.reload({ only: ['users', 'counts'] }),
            60_000,
        );

        return () => window.clearInterval(interval);
    }, []);

    return (
        <>
            <Head title="Admin · Users" />
            <AdminShell
                title="Users"
                description={`${counts.online} online · ${counts.total} total. Online means active in the last 3 minutes.`}
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-muted px-3 text-muted-foreground">
                        <Search className="size-4" />
                        <input
                            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                            onChange={(event) => {
                                const value = event.target.value;
                                setSearch(value);
                                window.clearTimeout(debounce.current);
                                debounce.current = window.setTimeout(
                                    () => visit({ search: value }),
                                    300,
                                );
                            }}
                            placeholder="Search name or email"
                            type="search"
                            value={search}
                        />
                    </label>
                    <div className="grid grid-cols-3 rounded-xl bg-muted p-1">
                        {(['all', 'online', 'offline'] as const).map(
                            (status) => (
                                <button
                                    className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
                                        filters.status === status
                                            ? 'bg-card text-brand'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    key={status}
                                    onClick={() => visit({ status })}
                                    type="button"
                                >
                                    {status}
                                </button>
                            ),
                        )}
                    </div>
                </div>

                <div className="overflow-hidden rounded-card bg-card">
                    {users.data.length === 0 ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            No users found.
                        </p>
                    ) : (
                        users.data.map((user) => (
                            <Link
                                className="flex items-center gap-3 border-b border-border/50 px-4 py-3 transition last:border-b-0 hover:bg-muted/40"
                                href={`/admin/users/${user.id}`}
                                key={user.id}
                            >
                                <Avatar name={user.name} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-foreground">
                                        {user.name}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {user.email} ·{' '}
                                        <span className="capitalize">
                                            {user.school_role.replace('_', ' ')}
                                        </span>
                                        {user.schools &&
                                            user.schools.length > 0 &&
                                            ` · ${user.schools.join(', ')}`}
                                    </span>
                                </span>
                                <span className="hidden text-xs text-muted-foreground sm:block">
                                    {lastSeenLabel(user)}
                                </span>
                                <StatusBadge user={user} />
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                            </Link>
                        ))
                    )}
                </div>

                <Pagination page={users} />
            </AdminShell>
        </>
    );
}

AdminUsers.layout = {
    breadcrumbs: [{ title: 'Admin', href: '/admin/users' }],
};
