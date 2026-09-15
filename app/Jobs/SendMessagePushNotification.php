<?php

namespace App\Jobs;

use App\Enums\ConversationType;
use App\Models\Message;
use App\Models\PushToken;
use App\Services\FirebasePushService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SendMessagePushNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [10, 60];

    public function __construct(
        public readonly int $messageId,
        public readonly int $pushTokenId,
    ) {}

    public function handle(FirebasePushService $firebase): void
    {
        if (! $firebase->configured()) {
            return;
        }

        $pushToken = PushToken::query()->find($this->pushTokenId);
        $message = Message::query()
            ->with(['conversation.team', 'sender'])
            ->find($this->messageId);
        if ($pushToken === null || $message === null || $message->unsent_at !== null) {
            return;
        }

        $participant = DB::table('conversation_participants')
            ->where('conversation_id', $message->conversation_id)
            ->where('user_id', $pushToken->user_id)
            ->first(['notification_preference']);
        if ($participant === null || $message->sender_id === $pushToken->user_id) {
            return;
        }

        $preference = $participant->notification_preference ?? 'all';
        if ($preference === 'muted') {
            return;
        }
        if ($preference === 'mentions' && ! $message->mentions()->where('user_id', $pushToken->user_id)->exists()) {
            return;
        }

        $conversation = $message->conversation;
        $senderName = $message->sender?->name;
        $preview = match ($message->type) {
            'attachment' => $message->body !== '' ? $message->body : 'Sent an attachment',
            'poll' => 'Created a poll: '.$message->body,
            'event' => 'Shared an event: '.$message->body,
            default => $message->body,
        };
        $isGroup = $conversation->type === ConversationType::Group;
        $title = $isGroup
            ? ($conversation->title ?: 'Group conversation')
            : ($senderName ?: 'Uhoo!');
        $body = $isGroup && $senderName !== null
            ? "{$senderName}: {$preview}"
            : $preview;

        $firebase->send(
            $pushToken,
            Str::limit($title, 100),
            Str::limit($body, 180),
            [
                'type' => 'new_message',
                'team_id' => (string) $conversation->team_id,
                'team_slug' => $conversation->team->slug,
                'conversation_id' => (string) $conversation->id,
                'message_id' => (string) $message->id,
            ],
        );
    }
}
