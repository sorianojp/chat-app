import { Search, X } from 'lucide-react';

/** Search field shown above the timeline while searching within a conversation. */
export function MessageSearchBar({
    value,
    onChange,
    onClose,
}: {
    value: string;
    onChange: (value: string) => void;
    onClose: () => void;
}) {
    return (
        <div className="border-b border-border bg-card px-4 py-3 md:px-6">
            <label className="flex h-11 items-center gap-2 rounded-xl bg-secondary/70 px-3 text-muted-foreground transition focus-within:bg-card focus-within:ring-4 focus-within:ring-ring/20">
                <Search className="size-4" />
                <input
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Search messages"
                    type="search"
                    value={value}
                />
                <button
                    aria-label="Close search"
                    className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={onClose}
                    type="button"
                >
                    <X className="size-4" />
                </button>
            </label>
        </div>
    );
}
