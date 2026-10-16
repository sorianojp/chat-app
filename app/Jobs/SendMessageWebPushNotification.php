<?php

namespace App\Jobs;

use App\Enums\ConversationType;
use App\Models\Message;
use App\Models\WebPushSubscription;
use App\Services\WebPushService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SendMessageWebPushNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [10, 60];

    public function __construct(
        public readonly int $messageId,
        public readonly int $subscriptionId,
    ) {}

    public function handle(WebPushService $webPush): void
    {
        if (! $webPush->configured()) {
            return;
        }

        $destination = WebPushSubscription::query()->find($this->subscriptionId);
        $message = Message::query()
            ->with(['attachments', 'conversation.team', 'sender'])
            ->find($this->messageId);

        if ($destination === null || $message === null || $message->unsent_at !== null) {
            return;
        }

        $participant = DB::table('conversation_participants')
            ->where('conversation_id', $message->conversation_id)
            ->where('user_id', $destination->user_id)
            ->first(['muted_at', 'notification_preference']);

        if ($participant === null || $message->sender_id === $destination->user_id) {
            return;
        }

        $preference = $participant->notification_preference ?? 'all';

        if ($participant->muted_at !== null || $preference === 'muted') {
            return;
        }

        if ($preference === 'mentions' && ! $message->mentions()->where('user_id', $destination->user_id)->exists()) {
            return;
        }

        $conversation = $message->conversation;
        $senderName = $message->sender?->name;
        $preview = match ($message->type) {
            'voice' => 'Sent a voice message',
            'attachment' => $message->body !== '' ? $message->body : ($message->attachments->count() > 1 ? 'Sent attachments' : 'Sent an attachment'),
            'poll' => 'Created a poll: '.$message->body,
            'event' => 'Shared an event: '.$message->body,
            default => $message->body,
        };
        $isGroup = in_array($conversation->type, [ConversationType::Group, ConversationType::Announcement], true);
        $title = $isGroup
            ? ($conversation->title ?: 'Group conversation')
            : ($senderName ?: 'Uhoo!');
        $body = $isGroup && $senderName !== null
            ? "{$senderName}: {$preview}"
            : $preview;
        $url = "/{$conversation->team->slug}/messenger?conversation={$conversation->id}";

        $webPush->send($destination, [
            'title' => Str::limit($title, 100),
            'body' => Str::limit($body !== '' ? $body : 'New message', 180),
            'icon' => '/favicon.ico',
            'badge' => '/favicon.ico',
            'tag' => "conversation-{$conversation->id}",
            'url' => $url,
            'message_id' => $message->id,
            'conversation_id' => $conversation->id,
        ]);
    }
}
