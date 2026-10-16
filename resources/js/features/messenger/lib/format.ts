import type { TypingUser } from '@/features/messenger/types';

export function timestamp(value: string | null) {
    return value ? new Date(value).getTime() : 0;
}

export function formatTime(value: string | null) {
    if (!value) {
        return 'No activity';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
    }).format(new Date(value));
}

export function formatRelativeLastSeen(value: string) {
    const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - timestamp(value)) / 1000),
    );

    if (elapsedSeconds < 60) {
        return 'just now';
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    if (elapsedMinutes < 60) {
        return `${elapsedMinutes} min ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);

    if (elapsedHours < 24) {
        return `${elapsedHours} ${elapsedHours === 1 ? 'hour' : 'hours'} ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);

    return `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago`;
}

export function offlineStatusLabel(lastSeenAt: string | null) {
    return lastSeenAt
        ? `Offline · ${formatRelativeLastSeen(lastSeenAt)}`
        : 'Offline';
}

export function formatFileSize(size: number) {
    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function formatSeenAt(value: string) {
    const seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(value).getTime()) / 1000),
    );

    if (seconds < 60) {
        return 'Seen Just Now';
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `Seen ${minutes} ${minutes === 1 ? 'Minute' : 'Minutes'} Ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `Seen ${hours} ${hours === 1 ? 'Hour' : 'Hours'} Ago`;
    }

    const days = Math.floor(hours / 24);

    return `Seen ${days} ${days === 1 ? 'Day' : 'Days'} Ago`;
}

export function initials(label: string) {
    return label
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export function typingLabel(users: TypingUser[]) {
    if (users.length === 0) {
        return '';
    }

    if (users.length === 1) {
        return `${users[0].name} is typing...`;
    }

    if (users.length === 2) {
        return `${users[0].name} and ${users[1].name} are typing...`;
    }

    return 'Several people are typing...';
}

export function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
