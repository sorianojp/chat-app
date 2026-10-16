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
