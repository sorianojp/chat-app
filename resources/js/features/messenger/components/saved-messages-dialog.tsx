import { Bookmark, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/features/messenger/lib/api';
import { formatTime } from '@/features/messenger/lib/format';
import { messagePreview } from '@/features/messenger/lib/messages';
import type { SavedMessage } from '@/features/messenger/types';

type SavedPage = {
    data: SavedMessage[];
    current_page: number;
    next_page_url: string | null;
};

/** The user's Saved list; picking an item opens it in its chat. */
export function SavedMessagesDialog({
    apiBaseUrl,
    onClose,
    onOpen,
}: {
    apiBaseUrl: string;
    onClose: () => void;
    onOpen: (saved: SavedMessage) => void;
}) {
    const [items, setItems] = useState<SavedMessage[]>([]);
    const [nextPage, setNextPage] = useState<number | null>(1);
    // The first page starts loading as the dialog opens.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchPage = useCallback(
        (page: number) =>
            apiFetch(`${apiBaseUrl}/saved-messages?page=${page}`, {
                method: 'GET',
            }).then((response) =>
                response.ok
                    ? (response.json() as Promise<SavedPage>)
                    : Promise.reject(new Error(String(response.status))),
            ),
        [apiBaseUrl],
    );

    const showPage = (page: number, result: SavedPage) => {
        setItems((current) =>
            page === 1 ? result.data : [...current, ...result.data],
        );
        setNextPage(result.next_page_url ? result.current_page + 1 : null);
    };

    const load = (page: number) => {
        setLoading(true);
        setError(false);
        fetchPage(page)
            .then((result) => showPage(page, result))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        let active = true;

        fetchPage(1)
            .then((result) => active && showPage(1, result))
            .catch(() => active && setError(true))
            .finally(() => active && setLoading(false));

        return () => {
            active = false;
        };
    }, [fetchPage]);

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-6 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                aria-labelledby="saved-messages-title"
                aria-modal="true"
                className="flex max-h-[min(680px,calc(100vh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
            >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                    <h2
                        className="text-base font-semibold text-foreground"
                        id="saved-messages-title"
                    >
                        Saved messages
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
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {items.map((saved) => (
                        <button
                            className="flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition hover:bg-muted/40"
                            key={saved.message.id}
                            onClick={() => onOpen(saved)}
                            type="button"
                        >
                            <span className="flex w-full items-center justify-between gap-3">
                                <span className="truncate text-xs font-semibold text-brand">
                                    {saved.conversation.display_name}
                                </span>
                                <span className="shrink-0 text-[11px] text-muted-foreground">
                                    {formatTime(saved.message.created_at)}
                                </span>
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                                {saved.message.sender?.name ?? 'Message'}
                            </span>
                            <span className="line-clamp-2 text-sm text-muted-foreground">
                                {messagePreview(saved.message)}
                            </span>
                        </button>
                    ))}
                    {!loading && !error && items.length === 0 && (
                        <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                                <Bookmark className="size-6" />
                            </span>
                            <h3 className="mt-3 text-sm font-semibold text-foreground">
                                No saved messages
                            </h3>
                            <p className="mt-1 max-w-72 text-sm leading-6 text-muted-foreground">
                                Save a message from its actions to find it here
                                later.
                            </p>
                        </div>
                    )}
                    {error && (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Could not load saved messages.{' '}
                            <button
                                className="font-semibold text-brand"
                                onClick={() => load(nextPage ?? 1)}
                                type="button"
                            >
                                Retry
                            </button>
                        </p>
                    )}
                    {nextPage !== null && items.length > 0 && !error && (
                        <button
                            className="w-full py-3 text-sm font-semibold text-brand disabled:text-muted-foreground"
                            disabled={loading}
                            onClick={() => load(nextPage)}
                            type="button"
                        >
                            {loading ? 'Loading...' : 'Load more'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
