<?php

namespace App\Services;

use App\Models\WebPushSubscription;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use RuntimeException;

class WebPushService
{
    /** @return array{publicKey: string, privateKey: string}|null */
    public function keys(): ?array
    {
        $publicKey = trim((string) config('services.web_push.public_key'));
        $privateKey = trim((string) config('services.web_push.private_key'));

        if ($publicKey !== '' && $privateKey !== '') {
            return compact('publicKey', 'privateKey');
        }

        $path = storage_path('app/private/web-push-vapid.json');

        if (! is_readable($path)) {
            return null;
        }

        $contents = file_get_contents($path);
        $keys = is_string($contents) ? json_decode($contents, true) : null;

        if (! is_array($keys) || ! is_string($keys['publicKey'] ?? null) || ! is_string($keys['privateKey'] ?? null)) {
            return null;
        }

        return [
            'publicKey' => $keys['publicKey'],
            'privateKey' => $keys['privateKey'],
        ];
    }

    public function configured(): bool
    {
        return $this->keys() !== null;
    }

    public function publicKey(): ?string
    {
        return $this->keys()['publicKey'] ?? null;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function send(WebPushSubscription $destination, array $payload): void
    {
        $keys = $this->keys();

        if ($keys === null) {
            return;
        }

        $webPush = new WebPush([
            'VAPID' => [
                'subject' => (string) config('services.web_push.subject', config('app.url')),
                'publicKey' => $keys['publicKey'],
                'privateKey' => $keys['privateKey'],
            ],
        ]);
        $subscription = new Subscription(
            $destination->endpoint,
            $destination->public_key,
            $destination->auth_token,
            $destination->content_encoding,
        );
        $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $report = $webPush->sendOneNotification($subscription, $json, [
            'TTL' => (int) config('services.web_push.ttl', 300),
            'urgency' => 'high',
            'topic' => 'message-'.($payload['message_id'] ?? $destination->id),
        ]);

        if ($report->isSuccess()) {
            return;
        }

        if ($report->isSubscriptionExpired()) {
            $destination->delete();

            return;
        }

        throw new RuntimeException('Web push failed: '.$report->getReason());
    }
}
