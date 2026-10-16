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
 * Same-origin API request with the XSRF header. Pass `json` for a JSON body,
 * or `body` for FormData (the browser sets the multipart boundary).
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

    return fetch(url, {
        method,
        credentials: 'same-origin',
        headers,
        body: json !== undefined ? JSON.stringify(json) : body,
    });
}
