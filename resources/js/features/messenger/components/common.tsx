import { UsersRound } from 'lucide-react';
import { initials } from '@/features/messenger/lib/format';
import type { Conversation } from '@/features/messenger/types';

export function Avatar({
    label,
    online = false,
    photoUrl,
    type,
}: {
    label: string;
    online?: boolean;
    photoUrl: string | null;
    type: Conversation['type'];
}) {
    return (
        <span
            className={`relative grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold ${
                type === 'direct'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground ring-1 ring-border'
            }`}
        >
            {photoUrl ? (
                <img
                    alt=""
                    className="size-full rounded-full object-cover"
                    src={photoUrl}
                />
            ) : type === 'direct' ? (
                initials(label)
            ) : (
                <UsersRound className="size-5" />
            )}
            {online && (
                <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-card bg-online" />
            )}
        </span>
    );
}

export function PanelTitle({
    className = '',
    icon,
    title,
}: {
    className?: string;
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <div
            className={`flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase ${className}`}
        >
            {icon}
            {title}
        </div>
    );
}

export function EmptyState({
    body,
    icon,
    title,
}: {
    body: string;
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                {icon}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
                {title}
            </h3>
            <p className="mt-1 max-w-72 text-sm leading-6 text-muted-foreground">
                {body}
            </p>
        </div>
    );
}
