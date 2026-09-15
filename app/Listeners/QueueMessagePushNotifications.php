<?php

namespace App\Listeners;

use App\Events\MessageCreated;
use App\Jobs\SendMessagePushNotification;
use App\Models\PushToken;
use App\Services\FirebasePushService;

class QueueMessagePushNotifications
{
    public function __construct(private readonly FirebasePushService $firebase) {}

    public function handle(MessageCreated $event): void
    {
        if (! $this->firebase->configured()) {
            return;
        }

        $message = $event->message;
        $recipientIds = $message->conversation->participants()
            ->when($message->sender_id !== null, fn ($query) => $query->whereKeyNot($message->sender_id))
            ->pluck('users.id');

        PushToken::query()
            ->whereIn('user_id', $recipientIds)
            ->pluck('id')
            ->each(fn (int $pushTokenId) => SendMessagePushNotification::dispatch($message->id, $pushTokenId));
    }
}
