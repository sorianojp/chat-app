import { echo } from '@laravel/echo-react';
import {
    BellRing,
    CalendarDays,
    ChevronRight,
    CircleDollarSign,
    Megaphone,
    Plus,
    RefreshCw,
    X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type {
    Notice,
    NoticeCategory,
    NoticePublishedPayload,
} from '@/features/messenger/types';

type NoticeFilter = 'all' | NoticeCategory;

type NoticePage = {
    data: Notice[];
    current_page: number;
    next_page_url: string | null;
};

type NewNoticePayload = {
    category: NoticeCategory;
    title: string;
    body: string;
};

const filters: { label: string; value: NoticeFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Announcements', value: 'announcement' },
    { label: 'Reminders', value: 'reminder' },
    { label: 'Events', value: 'event' },
    { label: 'Billing', value: 'billing' },
];

export function NoticesPanel({
    apiBaseUrl,
    canPublish,
    workspaceId,
    workspaceName,
}: {
    apiBaseUrl: string;
    canPublish: boolean;
    workspaceId: number;
    workspaceName: string;
}) {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [filter, setFilter] = useState<NoticeFilter>('all');
    const [nextPage, setNextPage] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
    const [composerOpen, setComposerOpen] = useState(false);

    const loadNotices = useCallback(
        async (page = 1, append = false) => {
            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }

            try {
                const parameters = new URLSearchParams({ page: String(page) });

                if (filter !== 'all') {
                    parameters.set('category', filter);
                }

                const response = await fetch(
                    `${apiBaseUrl}/notices?${parameters.toString()}`,
                    {
                        credentials: 'same-origin',
                        headers: { Accept: 'application/json' },
                    },
                );

                if (!response.ok) {
                    throw new Error(await responseError(response));
                }

                const payload = (await response.json()) as NoticePage;
                setNotices((current) =>
                    append ? mergeNotices(current, payload.data) : payload.data,
                );
                setNextPage(
                    payload.next_page_url ? payload.current_page + 1 : null,
                );
                setError(null);
            } catch (requestError) {
                setError(errorMessage(requestError));
            } finally {
                if (append) {
                    setLoadingMore(false);
                } else {
                    setLoading(false);
                }
            }
        },
        [apiBaseUrl, filter],
    );

    useEffect(() => {
        const initialLoad = window.setTimeout(() => void loadNotices(), 0);

        return () => window.clearTimeout(initialLoad);
    }, [loadNotices]);

    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === 'visible') {
                void loadNotices();
            }
        };
        const interval = window.setInterval(refresh, 30_000);
        document.addEventListener('visibilitychange', refresh);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [loadNotices]);

    useEffect(() => {
        const channel = echo()
            .private(`teams.${workspaceId}.notices`)
            .listen('.notice.published', (payload: NoticePublishedPayload) => {
                if (filter === 'all' || payload.notice.category === filter) {
                    setNotices((current) =>
                        mergeNotices([payload.notice], current),
                    );
                }
            });

        return () => {
            channel.stopListening('.notice.published');
            echo().leaveChannel(`private-teams.${workspaceId}.notices`);
        };
    }, [filter, workspaceId]);

    const publishNotice = async (
        payload: NewNoticePayload,
    ): Promise<string | null> => {
        try {
            const response = await fetch(`${apiBaseUrl}/notices`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                return await responseError(response);
            }

            const result = (await response.json()) as { data: Notice };

            if (filter === 'all' || result.data.category === filter) {
                setNotices((current) => mergeNotices([result.data], current));
            }

            setComposerOpen(false);

            return null;
        } catch (requestError) {
            return errorMessage(requestError);
        }
    };

    return (
        <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background md:min-h-[calc(100dvh-6.5rem)]">
            <header className="border-b border-border bg-card px-5 py-5 md:px-8">
                <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {workspaceName}
                        </p>
                        <h1 className="mt-1 text-2xl font-bold text-foreground">
                            Noticeboard
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            The latest announcements, reminders, events, and
                            billing updates from your school.
                        </p>
                    </div>
                    {canPublish && (
                        <button
                            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-solid px-4 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-solid/90"
                            onClick={() => setComposerOpen(true)}
                            type="button"
                        >
                            <Plus className="size-4" />
                            <span className="hidden sm:inline">
                                Publish notice
                            </span>
                            <span className="sm:hidden">Publish</span>
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
                <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
                    {filters.map((item) => (
                        <button
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                                filter === item.value
                                    ? 'bg-brand-solid text-brand-foreground'
                                    : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground'
                            }`}
                            key={item.value}
                            onClick={() => setFilter(item.value)}
                            type="button"
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {error && notices.length > 0 && (
                    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                        <span>{error}</span>
                        <button
                            className="shrink-0 font-semibold"
                            onClick={() => void loadNotices()}
                            type="button"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {loading ? (
                    <NoticeState
                        icon={<RefreshCw className="size-6 animate-spin" />}
                        title="Loading notices"
                        body="Checking the school noticeboard."
                    />
                ) : error && notices.length === 0 ? (
                    <NoticeState
                        action={
                            <button
                                className="mt-4 rounded-xl bg-brand-solid px-4 py-2 text-sm font-semibold text-brand-foreground"
                                onClick={() => void loadNotices()}
                                type="button"
                            >
                                Try again
                            </button>
                        }
                        icon={<Megaphone className="size-6" />}
                        title="Unable to load notices"
                        body={error}
                    />
                ) : notices.length === 0 ? (
                    <NoticeState
                        icon={<Megaphone className="size-6" />}
                        title="Nothing on the board yet"
                        body="School announcements, reminders, and events will appear here."
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {notices.map((notice) => (
                            <NoticeCard
                                key={notice.id}
                                notice={notice}
                                onOpen={() => setSelectedNotice(notice)}
                            />
                        ))}
                    </div>
                )}

                {nextPage !== null && notices.length > 0 && (
                    <div className="mt-6 flex justify-center">
                        <button
                            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted disabled:text-muted-foreground"
                            disabled={loadingMore}
                            onClick={() => void loadNotices(nextPage, true)}
                            type="button"
                        >
                            {loadingMore ? 'Loading…' : 'Load more notices'}
                        </button>
                    </div>
                )}
            </main>

            {selectedNotice && (
                <NoticeDetail
                    notice={selectedNotice}
                    onClose={() => setSelectedNotice(null)}
                />
            )}
            {composerOpen && (
                <NoticeComposer
                    onClose={() => setComposerOpen(false)}
                    onPublish={publishNotice}
                />
            )}
        </div>
    );
}

function NoticeCard({
    notice,
    onOpen,
}: {
    notice: Notice;
    onOpen: () => void;
}) {
    return (
        <button
            className="group flex min-h-64 flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
            onClick={onOpen}
            type="button"
        >
            <div className="flex w-full items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                    <NoticeCategoryIcon
                        category={notice.category}
                        className="size-4.5"
                    />
                </span>
                <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    {categoryLabel(notice.category)}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                    {formatNoticeDate(notice.published_at)}
                </span>
            </div>
            <h2 className="mt-5 line-clamp-2 text-lg font-bold text-foreground">
                {notice.title}
            </h2>
            <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                {notice.body}
            </p>
            <div className="mt-5 flex w-full items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <span className="grid size-7 place-items-center rounded-full bg-muted font-bold text-foreground">
                    {initials(notice.author?.name ?? 'School')}
                </span>
                <span className="min-w-0 flex-1 truncate">
                    {notice.author?.name ?? 'School'}
                </span>
                <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
            </div>
        </button>
    );
}

function NoticeDetail({
    notice,
    onClose,
}: {
    notice: Notice;
    onClose: () => void;
}) {
    return (
        <div
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
        >
            <article className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl md:p-8">
                <div className="flex items-start justify-between gap-4">
                    <span className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
                        <NoticeCategoryIcon
                            category={notice.category}
                            className="size-6"
                        />
                    </span>
                    <button
                        aria-label="Close notice"
                        className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                <p className="mt-6 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    {categoryLabel(notice.category)}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
                    {notice.title}
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                    {notice.author?.name ?? 'School'} ·{' '}
                    {formatNoticeDate(notice.published_at, true)}
                    {notice.school_class
                        ? ` · ${notice.school_class.name}`
                        : ''}
                </p>
                <div className="mt-8 text-base leading-7 whitespace-pre-wrap text-foreground">
                    {notice.body}
                </div>
            </article>
        </div>
    );
}

function NoticeComposer({
    onClose,
    onPublish,
}: {
    onClose: () => void;
    onPublish: (payload: NewNoticePayload) => Promise<string | null>;
}) {
    const [category, setCategory] = useState<NoticeCategory>('announcement');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const canSubmit = title.trim() !== '' && body.trim() !== '';

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit || publishing) {
            return;
        }

        setPublishing(true);
        setError(null);
        const publishError = await onPublish({
            category,
            title: title.trim(),
            body: body.trim(),
        });
        setPublishing(false);
        setError(publishError);
    };

    return (
        <div
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
        >
            <form
                className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            Publish a notice
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Share an update with your school workspace.
                        </p>
                    </div>
                    <button
                        aria-label="Close"
                        className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <label className="mt-6 block text-sm font-semibold text-foreground">
                    Category
                    <select
                        className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal outline-none focus:border-brand"
                        onChange={(event) =>
                            setCategory(event.target.value as NoticeCategory)
                        }
                        value={category}
                    >
                        {filters.slice(1).map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="mt-4 block text-sm font-semibold text-foreground">
                    Title
                    <input
                        autoFocus
                        className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal outline-none focus:border-brand"
                        maxLength={180}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="What should everyone know?"
                        value={title}
                    />
                </label>
                <label className="mt-4 block text-sm font-semibold text-foreground">
                    Notice
                    <textarea
                        className="mt-2 min-h-48 w-full rounded-xl border border-border bg-card p-3 leading-6 font-normal outline-none focus:border-brand"
                        maxLength={10000}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder="Write the details here…"
                        value={body}
                    />
                </label>

                {error && (
                    <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        {error}
                    </p>
                )}

                <button
                    className="mt-6 h-11 w-full rounded-xl bg-brand-solid text-sm font-semibold text-brand-foreground disabled:bg-muted disabled:text-muted-foreground"
                    disabled={!canSubmit || publishing}
                    type="submit"
                >
                    {publishing ? 'Publishing…' : 'Publish notice'}
                </button>
            </form>
        </div>
    );
}

function NoticeState({
    action,
    body,
    icon,
    title,
}: {
    action?: React.ReactNode;
    body: string;
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
                {icon}
            </span>
            <h2 className="mt-4 text-base font-bold text-foreground">
                {title}
            </h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                {body}
            </p>
            {action}
        </div>
    );
}

function NoticeCategoryIcon({
    category,
    className,
}: {
    category: NoticeCategory;
    className: string;
}) {
    switch (category) {
        case 'reminder':
            return <BellRing className={className} />;
        case 'event':
            return <CalendarDays className={className} />;
        case 'billing':
            return <CircleDollarSign className={className} />;
        default:
            return <Megaphone className={className} />;
    }
}

function categoryLabel(category: NoticeCategory) {
    return category[0].toUpperCase() + category.slice(1);
}

function formatNoticeDate(value: string | null, detailed = false) {
    if (!value) {
        return 'Just now';
    }

    const date = new Date(value);

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: detailed ? 'long' : 'medium',
        ...(detailed ? { timeStyle: 'short' as const } : {}),
    }).format(date);
}

function mergeNotices(first: Notice[], second: Notice[]) {
    return Array.from(
        new Map(
            [...first, ...second].map((notice) => [notice.id, notice]),
        ).values(),
    );
}

function initials(label: string) {
    return label
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

function getCookie(name: string) {
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}

function errorMessage(error: unknown) {
    return error instanceof Error
        ? error.message
        : 'The request could not be completed.';
}

async function responseError(response: Response) {
    try {
        const payload = (await response.json()) as {
            errors?: Record<string, string[]>;
            message?: string;
        };
        const validationMessage = payload.errors
            ? Object.values(payload.errors)[0]?.[0]
            : null;

        return (
            validationMessage ??
            payload.message ??
            'The request could not be completed.'
        );
    } catch {
        return 'The request could not be completed.';
    }
}
