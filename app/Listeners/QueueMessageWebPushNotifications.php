<?php

namespace App\Listeners;

use App\Events\MessageCreated;
use App\Jobs\SendMessageWebPushNotification;
use App\Models\WebPushSubscription;
use App\Services\WebPushService;

class QueueMessageWebPushNotifications
{
    public function __construct(private readonly WebPushService $webPush) {}

    public function handle(MessageCreated $event): void
    {
        if (! $this->webPush->configured()) {
            return;
        }

        $message = $event->message;
        $recipientIds = $message->conversation->participants()
            ->when($message->sender_id !== null, fn ($query) => $query->whereKeyNot($message->sender_id))
            ->pluck('users.id');

        WebPushSubscription::query()
            ->whereIn('user_id', $recipientIds)
            ->pluck('id')
            ->each(fn (int $subscriptionId) => SendMessageWebPushNotification::dispatch($message->id, $subscriptionId));
    }
}
