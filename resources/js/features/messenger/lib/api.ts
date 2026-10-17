import { echo } from '@laravel/echo-react';

export async function apiErrorMessage(response: Response) {
    try {
        const payload = (await response.json()) as {
            message?: string;
            errors?: Record<string, string[]>;
        };
        const validationMessage = Object.values(payload.errors ?? {})[0]?.[0];

        return validationMessage ?? payload.message ?? 'Please try again.';
    } catch {
        return 'Please try again.';
    }
}

export function getCookie(name: string) {
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}

/**
 * The current Reverb connection's socket ID, or null before Echo connects.
 */
function currentSocketId(): string | null {
    try {
        return echo().socketId() ?? null;
    } catch {
        return null;
    }
}

/**
 * Same-origin API request with the XSRF header. Pass `json` for a JSON body,
 * or `body` for FormData (the browser sets the multipart boundary).
 *
 * Sends `X-Socket-ID` so the server's `->toOthers()` broadcasts skip this tab,
 * which already applies the response itself (other tabs still receive them).
 */
export function apiFetch(
    url: string,
    { method, json, body }: { method: string; json?: unknown; body?: FormData },
) {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
    };

    if (json !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const socketId = currentSocketId();

    if (socketId) {
        headers['X-Socket-ID'] = socketId;
    }

    return fetch(url, {
        method,
        credentials: 'same-origin',
        headers,
        body: json !== undefined ? JSON.stringify(json) : body,
    });
}
