import { echo } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import { getCookie } from '@/features/messenger/lib/api';
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from '@/features/messenger/lib/constants';
import { uniqueUserIds } from '@/features/messenger/lib/conversations';
import type { PresenceUser } from '@/features/messenger/types';

/**
 * Sends a presence heartbeat while the tab is visible and tracks who is online
 * in the workspace. Also re-renders on the heartbeat interval so relative
 * "last seen" labels stay fresh.
 */
export function usePresence({
    apiBaseUrl,
    workspaceId,
    onUserLeft,
}: {
    apiBaseUrl: string;
    workspaceId: number;
    onUserLeft: (userId: number, lastSeenAt: string) => void;
}) {
    const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
    const [, setRelativeTimeTick] = useState(0);
    const onUserLeftRef = useRef(onUserLeft);

    useEffect(() => {
        onUserLeftRef.current = onUserLeft;
    }, [onUserLeft]);

    useEffect(() => {
        const heartbeat = () => {
            if (document.visibilityState === 'hidden') {
                return;
            }

            void fetch(`${apiBaseUrl}/presence`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                keepalive: true,
            });
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                heartbeat();
            }
        };

        heartbeat();
        const heartbeatInterval = window.setInterval(
            heartbeat,
            PRESENCE_HEARTBEAT_INTERVAL_MS,
        );
        const relativeTimeInterval = window.setInterval(
            () => setRelativeTimeTick((tick) => tick + 1),
            PRESENCE_HEARTBEAT_INTERVAL_MS,
        );
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(heartbeatInterval);
            window.clearInterval(relativeTimeInterval);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
        };
    }, [apiBaseUrl]);

    useEffect(() => {
        const channel = echo<'reverb'>().join(`teams.${workspaceId}.presence`);

        channel
            .here((users: PresenceUser[]) => {
                setOnlineUserIds(uniqueUserIds(users.map((user) => user.id)));
            })
            .joining((user: PresenceUser) => {
                setOnlineUserIds((ids) => uniqueUserIds([...ids, user.id]));
            })
            .leaving((user: PresenceUser) => {
                setOnlineUserIds((ids) =>
                    ids.filter((userId) => userId !== user.id),
                );
                onUserLeftRef.current(user.id, new Date().toISOString());
            });

        return () => {
            echo<'reverb'>().leave(`teams.${workspaceId}.presence`);
        };
    }, [workspaceId]);

    return onlineUserIds;
}
