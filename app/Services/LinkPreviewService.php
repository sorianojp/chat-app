<?php

namespace App\Services;

use DOMDocument;
use DOMXPath;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class LinkPreviewService
{
    /**
     * @return array<int, array<string, string|null>>
     */
    public function previewsFor(string $text): array
    {
        if (! config('messenger.fetch_link_previews', true)) {
            return [];
        }

        if (app()->environment('testing') && ! config('messenger.fetch_link_previews_in_tests')) {
            return [];
        }

        preg_match_all('/https?:\/\/[^\s<>"\']+/i', $text, $matches);

        return collect($matches[0])
            ->map(fn (string $url): string => rtrim($url, '.,);]'))
            ->unique()
            ->take(2)
            ->map(fn (string $url): ?array => $this->preview($url))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return array<string, string|null>|null
     */
    private function preview(string $url): ?array
    {
        if (! $this->isPublicUrl($url)) {
            return null;
        }

        try {
            $response = Http::accept('text/html,application/xhtml+xml')
                ->withUserAgent('SchoolMessengerLinkPreview/1.0')
                ->connectTimeout(2)
                ->timeout(4)
                ->withOptions(['allow_redirects' => false])
                ->get($url);

            if (! $this->isHtmlResponse($response)) {
                return null;
            }

            $html = Str::limit($response->body(), 1_500_000, '');
            $document = new DOMDocument;
            $previous = libxml_use_internal_errors(true);
            $document->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
            $xpath = new DOMXPath($document);
            $title = $this->meta($xpath, 'og:title') ?: trim((string) $document->getElementsByTagName('title')->item(0)?->textContent);
            $description = $this->meta($xpath, 'og:description') ?: $this->namedMeta($xpath, 'description');
            $image = $this->meta($xpath, 'og:image');

            return [
                'url' => $url,
                'host' => (string) parse_url($url, PHP_URL_HOST),
                'title' => $title !== '' ? Str::limit($title, 200) : null,
                'description' => $description !== '' ? Str::limit($description, 300) : null,
                'image_url' => $image && $this->isPublicUrl($image) ? $image : null,
            ];
        } catch (Throwable) {
            return null;
        }
    }

    private function isHtmlResponse(Response $response): bool
    {
        if (! $response->successful()) {
            return false;
        }

        $contentType = Str::lower($response->header('Content-Type'));

        return $contentType === '' || Str::contains($contentType, ['text/html', 'application/xhtml+xml']);
    }

    private function meta(DOMXPath $xpath, string $property): string
    {
        return trim((string) $xpath->query("//meta[@property='{$property}']/@content")?->item(0)?->nodeValue);
    }

    private function namedMeta(DOMXPath $xpath, string $name): string
    {
        return trim((string) $xpath->query("//meta[translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='{$name}']/@content")?->item(0)?->nodeValue);
    }

    private function isPublicUrl(string $url): bool
    {
        $parts = parse_url($url);
        $scheme = Str::lower((string) ($parts['scheme'] ?? ''));
        $host = Str::lower((string) ($parts['host'] ?? ''));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '' || $host === 'localhost' || Str::endsWith($host, '.local')) {
            return false;
        }

        $addresses = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : gethostbynamel($host);

        if (! is_array($addresses) || $addresses === []) {
            return false;
        }

        return collect($addresses)->every(fn (string $address): bool => filter_var(
            $address,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) !== false);
    }
}
