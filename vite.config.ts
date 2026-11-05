import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

// The logo is served from public/ under a fixed URL, so Cloudflare and browsers
// cache it for hours. Versioning the URL by its content means a new logo shows
// up on the next deploy. Must match logoVersion in app.blade.php.
const logoVersion = createHash('md5')
    .update(readFileSync('public/assets/logo.png'))
    .digest('hex')
    .slice(0, 8);

export default defineConfig(({ mode }) => ({
    define: {
        __LOGO_VERSION__: JSON.stringify(logoVersion),
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            buildDirectory: mode === 'e2e' ? 'build-e2e' : 'build',
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600, 700],
                }),
            ],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
}));
